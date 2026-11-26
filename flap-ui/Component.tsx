// Detail-only surface adapted from Flap's launcher-detail/v1 workshop template.
// The external project page verifies the instance against the Portal before wallet writes.
type Props = {
  context: {identity:{chainId:number;factoryAddress?:string};launcherAddress:string|null;
    snapshot:{sold?:string|null;pool?:string|null;token?:string|null}|null};
  messages: Record<string,string>;
};
export function Launcher({context,messages}:Props) {
  const {identity,launcherAddress,snapshot}=context;
  const known=identity.chainId===97 && identity.factoryAddress?.toLowerCase()==="0x03580dc9d429d64700822d8816f74ed5b622c1dc";
  const url=known && launcherAddress && /^0x[0-9a-f]{40}$/i.test(launcherAddress)
    ? "https://eoc-gold.github.io/hexpit-flap-launch/?launcher="+launcherAddress+"#wallet" : null;
  const pool=snapshot?.pool && !/^0x0{40}$/i.test(snapshot.pool) ? snapshot.pool : null;
  return <section style={{padding:20,overflowWrap:"anywhere"}}><h2>{messages.title}</h2>
    <p>{messages.minted} · {snapshot?.sold??"?"} / 12</p>
    <p>{pool ? messages.pool+" · "+pool : messages.waiting}</p>
    {url ? <a href={url} target="_blank" rel="noopener noreferrer">{messages.review}</a> : <p>{messages.missing}</p>}
  </section>;
}
