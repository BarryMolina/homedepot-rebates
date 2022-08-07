const puppeteer = require('puppeteer');
const functions = require('@google-cloud/functions-framework');

functions.http('main', (req, res) => {
	console.log(req.body)
	console.log(req.body.date)
	res.json(req.body);
})

const rebateApply = async (me) => {
	const browser = await puppeteer.launch({
		// headless: false,
		// sloMo: 250
	});
	const page = await browser.newPage();

	// Navigate to the Home Depot rebate application page
	await page.goto('https://www.homedepotrebates11percent.com/#/home', { waitUntil: 'networkidle2' });
	await page.waitForNetworkIdle();

	// Fill out purchase date
	await page.type('#purchaseDateOnlyText', '07/22/22');
	await page.click('#home-offer-purchasedate-continue2');
	await page.waitForNetworkIdle();

	// Continue
	await page.click('#continueOrSubmitBtn')
	await page.waitForNetworkIdle();

	// Enter receipt number and total
	await page.type('#Receipt\\ Number', '49410005277629')
	await page.type('#Gross\\ Sales', '7.35')
	await page.click('#continueOrSubmitBtn')
	await page.waitForNetworkIdle();

	// Select gift card type
	await page.click('#The\\ Home\\ Depot\\ Physical\\ Gift\\ Card')
	await page.click('#continueOrSubmitBtn')

	// Enter personal info
	// For each field, enter the value from the me object
	await page.type('input[name=firstName]', me.first_name)
	await page.type('input[name=lastName]', me.last_name)
	await page.type('input[name=phoneNumber]', me.phone)
	await page.type('input[name=email]', me.email)
	await page.type('input[name=confirmEmail]', me.email)
	await page.type('input[name=address1]', me.street)
	await page.type('input[name=postalCode]', me.zip)
	await page.type('input[name=city]', me.city)
	await page.select('select[name=country]', me.country)
	await page.select('select[name=state]', me.state)
	await page.$eval('input#emailOptIn', check => check.checked = false)

	// Use reccomended address
	await page.click('#continueBtn > button')
	await page.waitForNetworkIdle();

	if (await page.$('div.modal-dialog') !== null) {
		await page.click('#recommendedAddressBtn')
		await page.waitForNetworkIdle();
	}

	// Submit application
	// await page.click('#continueOrSubmitBtn')
	// await page.waitForNetworkIdle();
}