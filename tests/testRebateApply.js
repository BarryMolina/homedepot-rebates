const puppeteer = require('puppeteer');

const { rebateApply } = require('../src/rebateApply.js')
const { me } = require('../me.js')

async function testRebateApply() {
	const browser = await puppeteer.launch({
		headless: false,
		// sloMo: 250
	});

	rebateApply(browser, me, '49410005277629', '7.35', '07/22/22')
}

testRebateApply()
