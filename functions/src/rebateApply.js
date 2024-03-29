const puppeteer = require("puppeteer");

const rebateApply = async (
  browser,
  me,
  receiptNum,
  receiptTotal,
  purchaseDate
) => {
  validateInput(me, receiptNum, receiptTotal, purchaseDate);

  let applyState = "start";

  const page = await browser.newPage();

  try {
    // Navigate to the Home Depot rebate application page
    applyState = "Navigate to the Home Depot rebate application page";
    await page.goto("https://www.homedepotrebates11percent.com/#/home", {
      waitUntil: "networkidle2",
    });
    await page.waitForNetworkIdle();

    // Fill out purchase date
    applyState = "Fill out purchase date";
    await page.type("#purchaseDateOnlyText", purchaseDate);
    await page.click("#home-offer-purchasedate-continue2");
    await page.waitForNetworkIdle();

    // Check if purchase date is valid
    if ((await page.$('strong[ng-bind-html="noPromotionError"]')) !== null) {
      throw new Error("Invalid purchase date");
    }

    // Continue
    await page.click("#continueOrSubmitBtn");
    await page.waitForNetworkIdle();

    // Enter receipt number and total
    applyState = "Enter receipt number and total";
    await page.type("#Receipt\\ Number", receiptNum);
    await page.type("#Gross\\ Sales", receiptTotal);
    await page.click("#continueOrSubmitBtn");
    await page.waitForNetworkIdle();

    // Enter personal info
    // For each field, enter the value from the me object
    applyState = "Enter personal info";
    await page.type("input[name=firstName]", me.first_name);
    await page.type("input[name=lastName]", me.last_name);
    await page.type("input[name=phoneNumber]", me.phone);
    await page.type("input[name=email]", me.email);
    await page.type("input[name=confirmEmail]", me.email);
    await page.type("input[name=address1]", me.street);
    await page.type("input[name=postalCode]", me.zip);
    await page.type("input[name=city]", me.city);
    await page.select("select[name=country]", me.country);
    await page.select("select[name=state]", me.state);
    await page.$eval("input#emailOptIn", (check) => (check.checked = false));

    // Use recommended address
    applyState = "Use recommended address";
    await page.click("#continueBtn > button");
    await page.waitForNetworkIdle();

    if ((await page.$("div.modal-dialog")) !== null) {
      await page.click("#recommendedAddressBtn");
      await page.waitForNetworkIdle();
    }

    // Submit application
    applyState = "Submitting application";
    await page.click("#continueOrSubmitBtn");
    await page.waitForNetworkIdle();

    // // Get tracking number
    applyState = "Getting tracking number";
    const trackingSelector = await page.$("#confirmation-trackingNumber");
    const trackingNumber = await (
      await trackingSelector.getProperty("textContent")
    ).jsonValue();
    console.log(`Tracking number: ${trackingNumber}`);

    return trackingNumber;
  } catch (error) {
    const errorPage = page.url();
    throw new Error(
      `Error in rebateApply. ${applyState} at ${errorPage}: ${error.message}`,
      {
        cause: error,
        details: "foo",
      }
    );
  }
};

// Validate input.
function validateInput(me, receiptNum, receiptTotal, purchaseDate) {
  if (
    !me.first_name ||
    !me.last_name ||
    !me.phone ||
    !me.email ||
    !me.street ||
    !me.zip ||
    !me.city ||
    !me.country ||
    !me.state
  ) {
    throw new Error("Missing personal info");
  }
  if (!receiptNum || !receiptTotal || !purchaseDate) {
    throw new Error("Missing receipt info");
  }

  if (
    typeof receiptNum !== "string" ||
    typeof receiptTotal !== "string" ||
    typeof purchaseDate !== "string"
  ) {
    throw new Error("Invalid receipt info");
  }

  // Use regex to check that receiptNum is a string containing 14 digits
  const receiptNumRegex = /^\d{14}$/;
  if (!receiptNumRegex.test(receiptNum)) {
    throw new Error("Invalid receipt number");
  }

  // Use regex to check that receiptTotal is a string containing one or more digits followed by a period and two more digits
  const receiptTotalRegex = /^\d+\.\d{2}$/;
  if (!receiptTotalRegex.test(receiptTotal)) {
    throw new Error("Invalid receipt total");
  }

  // Use regex to check that purchaseDate is a string containing two digits for the month and two digits for the day and two digits for the year
  const purchaseDateRegex = /^\d{2}\/\d{2}\/\d{2}$/;
  if (!purchaseDateRegex.test(purchaseDate)) {
    throw new Error("Invalid purchase date");
  }
}

exports.rebateApply = rebateApply;
