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
const STATUS_HEADER = "status";

/**
 * Statuses
 */
const SUBMITTED_STATUS = "SUBMITTED";
const ERROR_STATUS = "ERROR";
const PENDING_STATUS = "PENDING";
const APPROVED_STATUS = "APPROVED";
const INVALID_DATE_STATUS = "INVALID DATE";

/**
 * Labels -- Add these labels to your Gmail account
 */
const NOT_APPLIED_LABEL = "Home Depot/Receipts/Not Applied";
const APPLIED_LABEL = "Home Depot/Receipts/Rebate Applied";

// Change this to the url asscoiated with your Google Cloud Function
const FUNCTION_URL = "https://homedepot-rebate-2e7shldrnq-uc.a.run.app";

/**
 * Receipt data gathered from email
 */
interface ReceiptInfo {
  messageId?: string;
  date?: string;
  receiptNum?: string;
  total?: string;
  trackingNum?: string;
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
      updateRebateStatus(sheet, receiptInfo.receiptNum, SUBMITTED_STATUS);
      // Star message to indicate it has been successfully submitted
      message.star();
      return trackingNum;
    } catch (e: any) {
      Logger.log(e);
      updateRebateStatus(sheet, receiptInfo.receiptNum, `ERROR: ${e.message}`); // e.g. `ERROR: Invalid date
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

// Log out threads and messages in the label
function logThreads() {
  var receiptThreads =
    GmailApp.getUserLabelByName(NOT_APPLIED_LABEL).getThreads();
  receiptThreads.forEach((t) => {
    Logger.log("thread: " + t.getId());
    t.getMessages().forEach((m) => {
      Logger.log("message:" + m.getId());
    });
  });
}

function submitReceipt(receiptData: ReceiptInfo): string {
  Logger.log("Submitting receipt from Apps Script: ");
  Logger.log(receiptData);
  const functionUrl = FUNCTION_URL;
  const token = ScriptApp.getIdentityToken();
  var options = {
    method: "post",
    headers: { Authorization: "Bearer " + token },
    payload: receiptData,
  };

  var res = UrlFetchApp.fetch(functionUrl, options);
  Logger.log(res);
  if (res.getResponseCode() == 200) {
    const result = JSON.parse(res.getContentText());
    if (result.trackingNumber) {
      return result.trackingNumber;
    } else if (result.error) {
      throw new Error(
        result.error.cause ? result.error.cause : result.error.message
      );
    } else {
      throw new Error("No tracking number returned.");
    }
  } else {
    throw new Error(res.getResponseCode() + " " + res);
  }
}

function start() {
  submitReceiptsFromSearch("label:" + NOT_APPLIED_LABEL);
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

function updateRebateStatus(sheet: Sheet, receiptNum: string, status: string) {
  setCellValue(sheet, RECEIPT_NUM_HEADER, receiptNum, STATUS_HEADER, status);
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
  setValue: string
) {
  var data = sheet.getDataRange().getDisplayValues();
  var row = getRow(data, searchHeader, searchValue);
  var col = getColByHeader(data, setHeader);
  if (row) {
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
