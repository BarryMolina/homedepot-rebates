const rebateTracker = async (browser, trackingNumber) => {
  let navState = "start";
  const page = await browser.newPage();

  try {
    navState = "Navigate to the Home Depot rebate tracker page";
    await page.goto("https://www.homedepotrebates11percent.com/#/tracker", {
      waitUntil: "networkidle2",
    });

    navState = "Click Search By Tracking Number";
    const seachByTracking = await page.waitForXPath(
      "//a[contains(., 'Search By Tracking Number')]",
      { timeout: 10000 }
    );
    await seachByTracking.click();

    navState = "Enter tracking number";
    await page.type("input[name='Tracking Number']", trackingNumber);

    navState = "Click Track";
    await page.click("button[aria-label='Track']:not(#trackByCustomerBtn");
    await page.waitForNetworkIdle();

    navState = "Click Tracking Number";
    const trackingNumberLink = await page.waitForXPath(
      `//a[contains(., '${trackingNumber}')]`,
      { timeout: 10000 }
    );
    await trackingNumberLink.click();
    await page.waitForNetworkIdle();

    const rebateStatus = await parseRebateStatusField(page, "Status");
    const submitDate = await parseRebateStatusField(page, "Submit Date");
    const rebateAmount = await parseRebateStatusField(page, "Rebate");
    const processedDate = await parseRebateStatusField(page, "Processed Date");

    return {
      rebateStatus,
      submitDate,
      rebateAmount,
      processedDate,
    };
  } catch (error) {
    const errorPage = page.url();
    throw new Error(
      `Error in rebateTracker: ${navState} at ${errorPage}: ${error.message}`,
      {
        cause: error,
      }
    );
  }
};

const parseRebateStatusField = async (page, label) => {
  const [span] = await page.$x(
    `//strong[contains(text(), '${label}')]/following-sibling::span`
  );
  if (span) {
    return await page.evaluate((el) => el.textContent, span);
  }
  return "";
};

module.exports = { rebateTracker };
