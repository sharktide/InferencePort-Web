"use client";

import { useEffect, useState } from "react";
import styles from "./Panel.module.css";
import ui from "./BucketsPanel.module.css";

const shellQuote = (value: string) => `'${value.replace(/'/g, `'"'"'`)}'`;

export default function BucketConnection({ apiBase, buckets, selectedName, canAdmin, onCredentials }: {
  apiBase: string;
  buckets: { name: string }[];
  selectedName?: string;
  canAdmin: boolean;
  onCredentials: () => void;
}) {
  const [choice, setChoice] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => { if (selectedName) setChoice(selectedName); }, [selectedName]);
  // Use the same API base as object transfers in this console, including local deployments.
  const endpoint = `${apiBase.replace(/\/+$/, "")}/s3/`;
  const bucket = buckets.some((item) => item.name === choice) ? choice : buckets[0]?.name || "";
  const uri = bucket ? `s3://${bucket}/` : "";
  const requestUrl = bucket ? endpoint + encodeURIComponent(bucket) + "/" : "";
  const profile = "inferenceport-buckets";
  const configure = `aws configure --profile ${profile}\naws configure set s3.addressing_style path --profile ${profile}\naws configure set s3.signature_version s3v4 --profile ${profile}`;
  const list = `aws --profile ${profile} --endpoint-url ${shellQuote(endpoint)} s3 ls ${shellQuote(uri)}`;
  const upload = `aws --profile ${profile} --endpoint-url ${shellQuote(endpoint)} s3 cp ./model.bin ${shellQuote(uri + "model.bin")}`;
  async function copy(value: string) {
    try { await navigator.clipboard.writeText(value); setNotice("Copied to clipboard."); }
    catch { setNotice("Clipboard unavailable. Select and copy the text instead."); }
  }
  function field(label: string, value: string) {
    return <div className={ui.connectionField}><label>{label}<input readOnly value={value} /></label>
      <button type="button" onClick={() => void copy(value)}>Copy {label.toLowerCase()}</button></div>;
  }
  function command(label: string, value: string) {
    return <div className={ui.command}><div className={ui.commandHeader}><h3>{label}</h3><button type="button" onClick={() => void copy(value)}>Copy {label.toLowerCase()}</button></div><pre><code>{value}</code></pre></div>;
  }
  return <section className={`${styles.card} ${styles.wide}`} aria-labelledby="bucket-connection-title">
    <h2 id="bucket-connection-title" className={styles.heading}>Connect with an S3 client</h2>
    <p>Every bucket uses the same S3 endpoint. Enter your bucket name separately in your client. These buckets are private; opening a bucket URL in a browser does not sign you in.</p>
    <p>Names belong to a workspace: two users can both have a bucket named <code>hi-test</code>. The S3 key pair identifies which user or organization owns the bucket you connect to.</p>
    {field("S3 endpoint", endpoint)}
    <div className={ui.connectionSettings}><p><strong>Signing region:</strong> <code>us-east-1</code></p><p><strong>Addressing:</strong> Path style</p><p><strong>Authentication:</strong> AWS Signature V4</p></div>
    {buckets.length > 0 ? <>
      <label>Connection bucket<select value={bucket} onChange={(event) => setChoice(event.target.value)}>{buckets.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}</select></label>
      {field("Bucket URI", uri)}
      {field("Bucket request URL", requestUrl)}
      <p>For this bucket, set the endpoint to <code>{endpoint}</code> and the bucket to <code>{bucket}</code>. Do not append the bucket name to your client’s endpoint setting.</p>
    </> : <p>Create a bucket above to see its URI and ready-to-copy transfer commands.</p>}
    <h3>1. Get your S3 credentials</h3>
    <p>{canAdmin ? <>Use <button type="button" className={ui.link} onClick={onCredentials}>S3 credentials</button> to issue an access key ID and secret access key.</> : "Ask a workspace administrator for an S3 access key ID and secret access key scoped to your bucket."} Use both values in your S3 client. Your normal InferencePort API key and console login are separate credentials. The secret is shown only once.</p>
    <p>A read-only credential can list and download. To upload, turn off “Read only” when issuing a credential.</p>
    <h3>2. Configure AWS CLI</h3>
    <p>Run the commands below. At the prompts, enter your issued S3 access key ID, secret access key, <code>us-east-1</code> for the default region, and <code>json</code> for output format. AWS CLI saves these values in your local AWS profile.</p>
    {command("Configure profile", configure)}
    {bucket && <><h3>3. List or upload files</h3>{command("List files", list)}{command("Upload a file", upload)}</>}
    {!endpoint.startsWith("https://") && <p>For SDK uploads and presigned URLs, use an HTTPS API endpoint. Unsigned payloads over HTTP are rejected. Local HTTPS deployments need a trusted certificate.</p>}
    <details className={ui.connectionHelp}><summary>Getting 403 Forbidden?</summary><ul>
      <li>An access-log status alone does not identify the cause. Check the S3 XML response’s Code and Message.</li>
      <li>Use the issued S3 key pair from the same personal or organization workspace as the bucket. Check expiry, revocation, and account permissions.</li>
      <li>Keep <code>/s3/</code> in the endpoint, use path style and signing region <code>us-east-1</code>.</li>
      <li>A credential restricted to a key prefix cannot list the bucket root. List its allowed prefix instead, such as <code>s3://{bucket || "your-bucket"}/allowed-prefix/</code>.</li>
      <li>Check your credential’s bucket permissions and any IP restrictions. Browser navigation does not send an S3 signature.</li>
    </ul></details>
    <p role="status" aria-live="polite">{notice}</p>
  </section>;
}
