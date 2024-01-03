const puppeteer = require("puppeteer");
const functions = require("@google-cloud/functions-framework");

const { rebateApply } = require("./rebateApply.js");
const { me } = require("../me.js");

functions.http("main", async (req, res) => {
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
    res.send({
      error: {
        message: error.message,
        cause: error.cause ? error.cause.message : "",
        details: error.details,
      },
    });
  }
});
