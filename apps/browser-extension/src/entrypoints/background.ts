import { defineBackground } from "wxt/utils/define-background";
import { startServiceWorker } from "../background/service-worker";

/** WXT 的 Manifest V3 service worker 入口。 */
export default defineBackground({
  type: "module",
  main(): void {
    startServiceWorker();
  }
});
