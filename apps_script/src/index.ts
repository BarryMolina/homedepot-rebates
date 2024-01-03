import GmailThread = GoogleAppsScript.Gmail.GmailThread;
import GmailMessage = GoogleAppsScript.Gmail.GmailMessage;
import Sheet = GoogleAppsScript.Spreadsheet.Sheet;

/**
 * Headers
 */
const MSG_ID_HEADER = "messageId";
const DATE_HEADER = "date";
const RECEIPT_NUM_HEADER = "receiptNum";
const TOTAL_HEADER = "total";
const TRACKING_NUM_HEADER = "trackingNum";
const STATUS_HEADER = "rebateStatus";
const SUBMIT_DATE_HEADER = "submitDate";
const PROCESSED_DATE_HEADER = "processedDate";
const REBATE_AMOUNT_HEADER = "rebateAmount";

/**
 * Statuses
 */
const SUBMITTED_STATUS = "SUBMITTED";
const ERROR_STATUS = "ERROR";
const PENDING_STATUS = "PENDING";
const APPROVED_STATUS = "APPROVED";
const INVALID_DATE_STATUS = "INVALID DATE";
const UNKNOWN_STATUS = "UNKNOWN";

/**
 * Labels -- Add these labels to your Gmail account
 */
const NOT_APPLIED_LABEL = "Home Depot/Receipts/Not Applied";
const APPLIED_LABEL = "Home Depot/Receipts/Rebate Applied";

// Change this to the url asscoiated with your Google Cloud Function
const SUBMIT_RECEIPT_FUNCTION =
  "https://homedepot-rebate-submitreceipt-2e7shldrnq-uc.a.run.app";
const REBATE_TRACKER_FUNCTION =
  "https://homedepot-rebate-rebatetracker-2e7shldrnq-uc.a.run.app";

/**
 * Receipt data gathered from email
 */
interface ReceiptInfo {
  messageId?: string;
  date?: string;
  receiptNum?: string;
  total?: string;
  trackingNum?: string;
  status?: string;
}

interface TrackedFields {
  rebateStatus?: string;
  submitDate?: string;
  processedDate?: string;
  rebateAmount?: string;
}

/**
 * Google Sheets column numbers are 1-based
 */
type ColumnNumber = number;

/**
 * Google Sheets row numbers are 1-based
 */
type RowNumber = number;

/**
 * Multi-dimensional array of data representing a Google Sheet
 */
type SheetData = string[][];

function parseReceiptMessage(message: GmailMessage) {
  const body = message.getPlainBody();
  const numDateRe = /(\d{4}\s{2}\d{5}\s{2}\d{5})\s+(\d{2}\/\d{2}\/\d{2})/;
  const totalRe = /\s*TOTAL\s+\$((?:\d{1,3},)*\d+.\d{2})/;
  const numDateMatch = body.match(numDateRe);
  const totalMatch = body.match(totalRe);
  if (totalMatch && numDateMatch) {
    let receiptInfo: ReceiptInfo = {
      messageId: message.getId(),
      receiptNum: numDateMatch[1].replace(/ /g, ""),
      date: numDateMatch[2],
      total: totalMatch[1].replace(/,/g, ""),
    };
    return receiptInfo;
  }
  return null;
}

function submitReceiptFromMessage(message: GmailMessage) {
  const receiptInfo = parseReceiptMessage(message);
  if (receiptInfo?.date && receiptInfo?.receiptNum && receiptInfo?.total) {
    // Append receipt info to Google Sheet
    var sheet = SpreadsheetApp.getActiveSheet();
    var data = sheet.getDataRange().getDisplayValues();
    // Check if receipt already exists in sheet
    const receiptRow = getRow(data, RECEIPT_NUM_HEADER, receiptInfo.receiptNum);
    if (!receiptRow) {
      sheet.appendRow([
        message.getId(),
        receiptInfo.date,
        receiptInfo.receiptNum,
        receiptInfo.total,
      ]);
    }
    try {
      const trackingNum = submitReceipt(receiptInfo);
      setTrackingNum(sheet, receiptInfo.receiptNum, trackingNum);
      setRebateStatus(sheet, receiptInfo.receiptNum, SUBMITTED_STATUS);
      // Star message to indicate it has been successfully submitted
      message.star();
      return trackingNum;
    } catch (e: any) {
      Logger.log(e);
      setRebateStatus(sheet, receiptInfo.receiptNum, `ERROR: ${e.message}`); // e.g. `ERROR: Invalid date
    }
  } else {
    Logger.log("Error parsing receipt: ");
    Logger.log(receiptInfo);
  }
  return null;
}

function submitReceiptsFromThread(thread: GmailThread) {
  let allProcessed = true;

  const messages = thread.getMessages();
  messages.forEach((message) => {
    // Check if message has already been processed
    if (!message.isStarred()) {
      const tracking = submitReceiptFromMessage(message);
      // If any message fails to submit, mark thread as not processed
      if (!tracking) {
        allProcessed = false;
      }
    }
  });
  // Check if all messages in thread have been processed
  if (allProcessed) {
    // Logger.log('All messages in thread have been processed: ' + thread.getId())
    thread.removeLabel(GmailApp.getUserLabelByName(NOT_APPLIED_LABEL));
    // Add label to indicate that rebate has been applied
    thread.addLabel(GmailApp.getUserLabelByName(APPLIED_LABEL));
  }
}

// Submit receipts in messages that match the search query
function submitReceiptsFromSearch(query: string) {
  const threads = GmailApp.search(query);
  threads.forEach((thread) => {
    submitReceiptsFromThread(thread);
  });
}

function submitOneReceipt() {
  var m = GmailApp.getMessageById("18a0482706ba5ab2");
  submitReceiptFromMessage(m);
}

function submitReceiptsFromOneThread() {
  var t = GmailApp.getThreadById("");
  submitReceiptsFromThread(t);
}

function submitReceipt(receiptData: ReceiptInfo): string {
  const res = performRequest(SUBMIT_RECEIPT_FUNCTION, "POST", receiptData);
  if (!res.trackingNumber) {
    throw new Error("No tracking number returned.");
  }
  return res.trackingNumber;
}

function submitReceipts() {
  submitReceiptsFromSearch("label:" + NOT_APPLIED_LABEL);
}

function updateTrackedFields(sheet: Sheet, trackingNumber: string) {
  try {
    const res = performRequest(REBATE_TRACKER_FUNCTION, "GET", {
      trackingNumber,
    });
    const { trackingNumber: _trackingNumber, ...trackedFields } = res;
    if (res) {
      setTrackedFields(sheet, trackingNumber, trackedFields);
    }
  } catch (e: any) {
    Logger.log(e);
  }
}

function updateTrackedFieldsAll() {
  var sheet = SpreadsheetApp.getActiveSheet();
  var data = sheet.getDataRange().getDisplayValues();
  loopSheetReceipts(data, ({ trackingNum }) => {
    if (trackingNum) {
      updateTrackedFields(sheet, trackingNum);
    }
  });
}

/**
 * Utility functions
 */

function setTrackingNum(sheet: Sheet, receiptNum: string, trackingNum: string) {
  setCellValue(
    sheet,
    RECEIPT_NUM_HEADER,
    receiptNum,
    TRACKING_NUM_HEADER,
    trackingNum
  );
}

function setTrackedFields(
  sheet: Sheet,
  trackingNum: string,
  trackedFields: TrackedFields
) {
  //loop through tracked fields and set values
  Object.keys(trackedFields).forEach((header) => {
    const value = trackedFields[header as keyof TrackedFields];
    setCellValue(sheet, TRACKING_NUM_HEADER, trackingNum, header, value);
  });
}

function setRebateStatus(
  sheet: Sheet,
  receiptNum: string,
  rebateStatus: string
) {
  setCellValue(
    sheet,
    RECEIPT_NUM_HEADER,
    receiptNum,
    STATUS_HEADER,
    rebateStatus
  );
}

// Get the row containing the specified value in a given column (starting at 1)
function getRowByColValue(
  data: SheetData,
  value: string,
  col: ColumnNumber
): RowNumber | null {
  for (var i = 1; i < data.length; i++) {
    // Logger.log('testing ' + data[i][col - 1] + ' == ' + value)
    if (data[i][col - 1] == value) {
      return i + 1;
    }
  }
  Logger.log("Unable to find row for " + value);
  return null;
}

function getRow(data: SheetData, header: string, value: string) {
  var col = getColByHeader(data, header);
  return getRowByColValue(data, value, col);
}

function setCellValue(
  sheet: Sheet,
  searchHeader: string,
  searchValue: string,
  setHeader: string,
  setValue: string | null | undefined
) {
  if (!setValue) {
    return;
  }
  var data = sheet.getDataRange().getDisplayValues();
  var row = getRow(data, searchHeader, searchValue);
  var col = getColByHeader(data, setHeader);
  if (row && col > 0) {
    var cell = sheet.getRange(row, col);
    cell.setValue(setValue);
  } else {
    Logger.log("Could not find " + searchHeader + " " + searchValue);
  }
}

function getHeaders(data: SheetData) {
  return data[0];
}

function getColByHeader(data: SheetData, header: string): ColumnNumber {
  return getHeaders(data).indexOf(header) + 1;
}

function performRequest(url: string, method = "GET", payload: any = {}) {
  const token = ScriptApp.getIdentityToken();
  var options = {
    method: method,
    headers: { Authorization: "Bearer " + token },
    payload: method === "POST" ? payload : undefined,
  };
  Logger.log(url);
  if (method === "GET" && Object.keys(payload).length > 0) {
    url +=
      "?" +
      Object.keys(payload)
        .map((k) => `${k}=${payload[k]}`)
        .join("&");
  }
  var res = UrlFetchApp.fetch(url, options);
  Logger.log(res);
  if (res.getResponseCode() == 200) {
    const data = JSON.parse(res.getContentText());
    if (data.error) {
      throw new Error(data.error.cause ? data.error.cause : data.error.message);
    }
    return data;
  } else {
    throw new Error(res.getResponseCode() + " " + res);
  }
}

// function to loop through all rows in sheet
function loopSheetReceipts(
  data: SheetData,
  callback: (receipt: ReceiptInfo) => void
) {
  const msgIdCol = getColByHeader(data, MSG_ID_HEADER);
  const dateCol = getColByHeader(data, DATE_HEADER);
  const receiptNumCol = getColByHeader(data, RECEIPT_NUM_HEADER);
  const totalCol = getColByHeader(data, TOTAL_HEADER);
  const trackingNumCol = getColByHeader(data, TRACKING_NUM_HEADER);
  const statusCol = getColByHeader(data, STATUS_HEADER);

  for (var i = 1; i < data.length; i++) {
    callback({
      messageId: data[i][msgIdCol - 1],
      date: data[i][dateCol - 1],
      receiptNum: data[i][receiptNumCol - 1],
      total: data[i][totalCol - 1],
      trackingNum: data[i][trackingNumCol - 1],
      status: data[i][statusCol - 1],
    });
  }
}
