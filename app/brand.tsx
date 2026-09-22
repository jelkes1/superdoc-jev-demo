import Link from "next/link";
export default function Brand() {
  return (
    <Link
      href="/"
      className="superdoc-brand"
      aria-label="SuperDoc and Jev demo"
    >
      <img src="/brand/superdoc-logo.png" width="34" height="38" alt="" />
      <span>SuperDoc</span>
      <span className="brand-partner">× Jev</span>
    </Link>
  );
}
