declare module "next/script" {
  type ScriptProps = {
    src?: string;
    id?: string;
    strategy?: "beforeInteractive" | "afterInteractive" | "lazyOnload" | "worker";
    onLoad?: () => void;
    onError?: () => void;
    children?: string;
    defer?: boolean;
    [key: string]: string | boolean | (() => void) | undefined;
  };

  const Script: React.FC<ScriptProps>;
  export default Script;
}
