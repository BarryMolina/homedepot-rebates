const puppeteer = require("puppeteer");
const functions = require("@google-cloud/functions-framework");

const { rebateApply } = require("./rebateApply.js");
const { rebateTracker } = require("./rebateTracker.js");
const { me } = require("../me.js");

functions.http("main", async (req, res) => {
  res.send("hello world");
});

functions.http("submit-receipt", async (req, res) => {
  const browser = await puppeteer.launch();
  const { date, receiptNum, total } = req.body;

  try {
    console.log(
      "Cloud function starting rebateApply with: ",
      date,
      receiptNum,
      total
    );
    const trackingNumber = await rebateApply(
      browser,
      me,
      receiptNum,
      total,
      date
    );
    if (trackingNumber) {
      console.log("Cloud function finished rebateApply with: ", trackingNumber);
      return res.send({ trackingNumber: trackingNumber });
    }
    console.log(
      "Cloud function error in rebateApply. No tracking number returned."
    );
    res.send({ error: { message: "No tracking number returned." } });
  } catch (error) {
    console.log(error);
    sendError(res, error);
  } finally {
    await browser.close();
  }
});

functions.http("rebate-tracker", async (req, res) => {
  const browser = await puppeteer.launch();
  const { trackingNumber } = req.query;
  try {
    const status = await rebateTracker(browser, trackingNumber);
    res.send({ trackingNumber: trackingNumber, ...status });
  } catch (error) {
    sendError(res, error);
  } finally {
    await browser.close();
  }
});

const sendError = (res, error) => {
  res.send({
    error: {
      message: error.message,
      cause: error.cause ? error.cause.message : "",
      details: error.details,
    },
  });
};
