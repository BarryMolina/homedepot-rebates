const puppeteer = require("puppeteer");

const { rebateApply } = require("../src/rebateApply.js");
const { me } = require("../me.js");

async function testRebateApply() {
  const browser = await puppeteer.launch({
    headless: false,
    // sloMo: 250
  });

  // rebateApply(browser, me, '49410006299184', '14.65', '08/05/22')
  // rebateApply(browser, me, '49410005189204', '8.94', '08/04/22')
  // rebateApply(browser, me, '49410005275508', '20.76', '08/04/22')
  // rebateApply(browser, me, '49070006127278', '26.31', '08/03/22')
  const tracking = rebateApply(
    browser,
    me,
    "49410005178025",
    "19.04",
    "12/19/23"
  );
}

testRebateApply();
