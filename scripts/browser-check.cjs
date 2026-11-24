const { spawn } = require("node:child_process");
const { randomBytes } = require("node:crypto");
const { mkdirSync } = require("node:fs");
const assert = require("node:assert/strict");
const { chromium } = require(process.env.SELLIO_PLAYWRIGHT_MODULE || "playwright");

const origin = "http://127.0.0.1:3045";
const code = randomBytes(32).toString("base64url");
const ownerEmail = "owner@example.test";
mkdirSync("data",{recursive:true});
const app = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", "3045"], {
  env: {...process.env, APP_URL:origin, SELLIO_NEXT_OUTPUT:".next-browser", SELLIO_DB:"data/browser-check-"+randomBytes(6).toString("hex")+".sqlite", SELLIO_DEV_MAIL:"console", SELLIO_PAYMENT_MODE:"test", OWNER_EMAIL:ownerEmail,
    OWNER_BOOTSTRAP_SECRET:code, SELLIO_ENCRYPTION_KEY:randomBytes(32).toString("base64") },
  stdio:["ignore","pipe","pipe"],
});
let serverOutput = "";
for (const stream of [app.stdout,app.stderr]) stream.on("data",(chunk)=>{serverOutput+=chunk;});

async function until(check) {
  for (let i=0;i<100;i++) {
    const value=await check();
    if (value) return value;
    await new Promise((resolve)=>setTimeout(resolve,200));
  }
  throw new Error("Timed out waiting for application");
}

async function register(page,email) {
  await page.goto(origin+"/register");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Пароль").fill("local-sellio-password-42");
  const before=serverOutput.length;
  await page.getByRole("button",{name:"Зарегистрироваться"}).click();
  await page.getByText("Если адрес подходит").waitFor();
  const url = await until(()=>serverOutput.slice(before).match(/http:\/\/127\.0\.0\.1:3045\/confirm\?token=[\w-]+/)?.[0]);
  await page.goto(url);
  await page.getByRole("button",{name:"Подтвердить email"}).click();
  await page.getByText("Email подтверждён. Теперь можно войти.").waitFor();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Пароль").fill("local-sellio-password-42");
  await page.getByRole("button",{name:"Войти",exact:true}).click();
  await page.waitForURL("**/dashboard");
}

async function main() {
  await until(async()=>{ try { return (await fetch(origin)).ok; } catch { return false; } });
  const browser=await chromium.launch({executablePath:process.env.SELLIO_BROWSER||undefined,headless:true,args:["--disable-gpu"]});
  try {
    const desktop=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:"reduce"});
    const problems=[];
    desktop.on("pageerror",(error)=>problems.push(error.message));
    await desktop.goto(origin);
    await desktop.evaluate(()=>document.fonts.ready);
    const desktopWidth=await desktop.evaluate(()=>document.documentElement.scrollWidth);
    assert.equal(desktopWidth,1440);
    assert.equal(await desktop.evaluate(()=>document.fonts.check('700 40px "Manrope Variable"',"Поиск компаний")),true);
    await desktop.getByRole("button",{name:"Можно ли уже оплатить тариф?"}).click();
    await desktop.getByText("Оплата пока недоступна. На сайте указаны предварительные цены.").waitFor();
    if (process.env.SELLIO_SCREENSHOT_DIR) {
      await desktop.goto(origin);
      await desktop.screenshot({path:require("node:path").join(process.env.SELLIO_SCREENSHOT_DIR,"sellio-desktop.png")});
    }
    const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,deviceScaleFactor:1,reducedMotion:"reduce"});
    await mobile.goto(origin);
    assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth),390);
    await mobile.getByText("Меню",{exact:true}).click();
    await mobile.getByRole("link",{name:"FAQ",exact:true}).last().waitFor();
    await mobile.getByRole("link",{name:"FAQ",exact:true}).last().click();
    assert.equal(await mobile.locator("details.mobile-menu").getAttribute("open"),null);
    if (process.env.SELLIO_SCREENSHOT_DIR) {
      await mobile.goto(origin);
      await mobile.screenshot({path:require("node:path").join(process.env.SELLIO_SCREENSHOT_DIR,"sellio-mobile.png")});
    }
    await desktop.goto(origin+"/dashboard");
    await desktop.waitForURL("**/login");
    await register(desktop,"regular@example.test");
    await desktop.getByRole("heading",{name:"Обзор",exact:true}).waitFor();
    const adminDenied=await desktop.goto(origin+"/admin");
    assert.equal(adminDenied.status(),404);
    await desktop.goto(origin+"/dashboard/billing");
    await desktop.getByRole("button",{name:"Активировать тестовый тариф"}).first().click();
    await desktop.getByText("Тестовый тариф активирован без оплаты.").waitFor();
    await desktop.goto(origin+"/dashboard/search");
    await desktop.getByLabel("Город").fill("Москва");
    await desktop.getByLabel("Категория").fill("Кофейни");
    await desktop.getByRole("button",{name:"Сохранить запрос"}).click();
    await desktop.getByText("Поиск сохранён.").waitFor();
    await desktop.getByRole("link",{name:"Кофейни · Москва"}).click();
    await desktop.waitForURL("**/dashboard/search?saved=*");
    await until(async()=>await desktop.getByLabel("Город").inputValue()==="Москва");
    await desktop.getByLabel("Страна").selectOption("US");
    assert.equal(await desktop.getByLabel("Источник").inputValue(),"google");
    assert.equal(await desktop.getByRole("button",{name:"Начать поиск"}).isDisabled(),true);

    await register(mobile,ownerEmail);
    await mobile.getByRole("button",{name:"Разделы кабинета"}).click();
    await mobile.getByRole("link",{name:"Настройки"}).click();
    await mobile.getByLabel("Код").fill(code);
    await mobile.getByRole("button",{name:"Подтвердить назначение"}).click();
    await mobile.waitForURL("**/admin");
    await mobile.getByRole("heading",{name:"Администрирование"}).waitFor();
    await mobile.goto(origin+"/dashboard/search");
    await mobile.getByText("Запросов пока нет.").waitFor();
    assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth),390);
    await mobile.goto(origin+"/dashboard/stock");
    await mobile.getByLabel("Название товара").fill("Лицензия для локальной проверки");
    await mobile.getByLabel("Ключ или содержимое").fill("local-stock-test-only");
    await mobile.getByRole("checkbox",{name:"У меня есть право"}).check();
    await mobile.getByRole("button",{name:"Добавить на склад"}).click();
    await mobile.getByText("Лицензия для локальной проверки").waitFor();
    assert.equal(await mobile.getByText("local-stock-test-only",{exact:true}).count(),0);
    await mobile.getByRole("button",{name:"Выйти"}).click();
    await mobile.waitForURL(origin+"/");
    assert.deepEqual(problems,[]);
    console.info("Browser check passed at widths 1440 and 390.");
  } finally { await browser.close(); }
}

main().catch((error)=>{console.error(error);console.error(serverOutput.replace(/token=[\w-]+/g,"token=[redacted]").slice(-5500));process.exitCode=1;}).finally(()=>app.kill());
