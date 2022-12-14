# homedepot-rebates
Google Apps Script + Cloud Functions project to parse emailed receipts from Home Depot and submit a 11% rebate application.

## apps_script
Google Apps Script project written in TypeScript that integrates with Gmail and Google Sheets. Uses regex to parse Home Depot emailed receipts and submit the data to a Cloud Function for processing. By default, looks for all emails labeled "Home Depot/Receipts/Not Applied". All emails are moved to "Home Depot/Receipts/Rebate Applied" once processed.

## functions
A node.js project that uses browser automation to fill out the rebate application form. Intended to be launched as a Google Cloud Function.

## Installation
1. Create a new Google Sheet and associated Apps Script Project
2. Create a new GCP project and connect it to the GAS script
3. Clone this repository and upload the Apps script code using ```clasp login && cd apps_script && npm run deploy```
4. Deploy the Cloud Function using ```gcloud init && cd functions && npm run deploy```
5. Update the function url with the one associated with your cloud function
6. Set up a trigger to run ```submitReceipts``` as often as you'd like
7. Enjoy automatic, pain-free rebate receipt applications!
