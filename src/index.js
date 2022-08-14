const puppeteer = require('puppeteer');
const functions = require('@google-cloud/functions-framework');

const { rebateApply } = require('./rebateApply.js')
const { me } = require('../me.js')

functions.http('main', async (req, res) => {
	const browser = await puppeteer.launch();

	const { date, receiptNum, total } = req.body

	try {
		await rebateApply(browser, me, receiptNum, total, date)
		res.send({ "success": true })
	} catch (error) {
		console.log(error)
		res.json({ "success": false, "error": error.message })
	}
})