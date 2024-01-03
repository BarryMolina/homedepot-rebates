# homedepot-rebates

Google Apps Script + Cloud Functions project to parse emailed receipts from Home Depot and submit a 11% rebate application.

## apps_script

Google Apps Script project written in TypeScript that integrates with Gmail and Google Sheets. Uses regex to parse Home Depot emailed receipts and submit the data to a Cloud Function for processing. By default, looks for all emails labeled "Home Depot/Receipts/Not Applied". All emails are moved to "Home Depot/Receipts/Rebate Applied" once processed.

## functions

A node.js project that uses browser automation to fill out the rebate application form. Intended to be launched as a Google Cloud Function.

## Installation

### Email Setup

1. In your Gmail inbox, create a new label called "Home Depot/Receipts/Not Applied"
2. Create another label called "Home Depot/Receipts/Rebate Applied"
3. Create a filter to automatically apply the "Home Depot/Receipts/Not Applied" label to all emails from "HomeDepot@order.homedepot.com" with the subject "Your Electronic Receipt".

### Project Setup

1. Create a new Google Sheet and associated Apps Script Project
2. Create a new GCP project and connect it to the GAS script
3. Clone this repository and upload the Apps script code using `clasp login && cd apps_script && npm run deploy`
4. Copy `me.example.js` to `me.js` and fill in the required information
5. Deploy the Cloud Function using `gcloud init && cd functions && npm run deploy`
6. Update the function url with the one associated with your cloud function
7. Set up a trigger to call the `submitReceipts()` function as often as you'd like
8. Enjoy automatic, pain-free rebate receipt applications!

## TODO

- [ ] Update the status of the rebate application in the Google Sheet when status update emails are received

## License

MIT License
