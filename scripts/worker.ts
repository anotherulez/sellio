import { setTimeout } from "node:timers/promises";
import { workNext } from "../lib/jobs";
import { run } from "../lib/db";
import { sendNextNotification } from "../lib/telegram";

let stopping = false;
for (const signal of ["SIGTERM", "SIGINT"] as const) process.on(signal, () => { stopping = true; });

async function main() {
  console.info("Sellio worker готов");
  let maintenance = 0;
  while (!stopping) {
    try {
      if (Date.now() > maintenance) {
        run("DELETE FROM tokens WHERE expires<?", Date.now());
        run("DELETE FROM rate_limits WHERE expires<?", Date.now());
        run("UPDATE jobs SET result=NULL WHERE result IS NOT NULL AND updated<?", Date.now()-7*86_400_000);
        maintenance = Date.now()+3_600_000;
      }
      await sendNextNotification();
      if (!await workNext()) await setTimeout(1200);
    } catch {
      console.error("Sellio worker: ошибка выполнения цикла");
      await setTimeout(5000);
    }
  }
}
void main();
