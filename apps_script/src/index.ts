import GmailMessage = GoogleAppsScript.Gmail.GmailMessage
import Sheet = GoogleAppsScript.Spreadsheet.Sheet

const MSG_ID_HEADER = 'messageId'
const DATE_HEADER = 'date'
const RECEIPT_NUM_HEADER = 'receiptNum'
const TOTAL_HEADER = 'total'
const TRACKING_NUM_HEADER = 'trackingNum'

/**
 * Receipt data gathered from email
 */
interface ReceiptInfo {
  messageId?: string
  date?: string
  receiptNum?: string
  total?: string
  trackingNum?: string
}

/** 
 * Google Sheets column numbers are 1-based
 */
type ColumnNumber = number

/** 
 * Google Sheets row numbers are 1-based
 */
type RowNumber = number

/**
 * Multi-dimensional array of data representing a Google Sheet
 */
type SheetData = string[][]


function getReceiptInfoFromGmail() {
  //var receiptThreads = GmailApp.getUserLabelByName('Home Depot/Receipts').getThreads()
  var receiptThreads = GmailApp.search('label:home-depot-receipts-not-applied is:read')
  let receiptMessages: GmailMessage[] = []
  receiptThreads.forEach((t) => {
    receiptMessages = [...receiptMessages, ...t.getMessages()]
  })
  Logger.log(receiptMessages.length)
  const numDateRe = /(\d{4}\s{2}\d{5}\s{2}\d{5})\s+(\d{2}\/\d{2}\/\d{2})/
  const totalRe = /\s*TOTAL\s+\$(\d+.\d{2})/
  const receiptsInfo: ReceiptInfo[] = receiptMessages.reduce<ReceiptInfo[]>((receiptsInfo, message) => {
    const body = message.getPlainBody()
    const numDateMatch = body.match(numDateRe)
    const totalMatch = body.match(totalRe)
    if (totalMatch && numDateMatch) {
      let receiptInfo: ReceiptInfo = {
        messageId: message.getId(),
        receiptNum: numDateMatch[1].replace(/ /g, ''),
        date: numDateMatch[2],
        total: totalMatch[1]
      }
      return [...receiptsInfo, receiptInfo]
    }
    return receiptsInfo
  }, [])
  return receiptsInfo
}

function submitReceipt(receiptData: ReceiptInfo): string | null {
  const functionUrl = 'https://homedepot-rebate-2e7shldrnq-uc.a.run.app'
  const token = ScriptApp.getIdentityToken()
  var options = {
    'method': 'post',
    'headers': { 'Authorization': 'Bearer ' + token },
    'payload': receiptData
  }

  var res = UrlFetchApp.fetch(functionUrl, options)
  Logger.log(res)
  if (res.getResponseCode() == 200) {
    const result = JSON.parse(res.getContentText())
    if (!result.error) {
      const trackingNum = result.trackingNumber
      Logger.log('Tracking number: ' + trackingNum)
      return trackingNum
    } else {
      Logger.log('Error: ' + result.error)
    }
  }
  return null
}

function writeReceiptsToSheet() {
  const receipts = getReceiptInfoFromGmail()
  var sheet = SpreadsheetApp.getActiveSheet()
  sheet.clear()
  sheet.appendRow([MSG_ID_HEADER, DATE_HEADER, RECEIPT_NUM_HEADER, TOTAL_HEADER, TRACKING_NUM_HEADER])
  receipts.forEach(receipt => {
    sheet.appendRow([receipt.messageId, receipt.date, receipt.receiptNum, receipt.total])
  })
}

function submitManyFromSheet() {

}

function submitFromSheet(sheet: Sheet, receiptInfo: ReceiptInfo) {
  const trackingNum = submitReceipt(receiptInfo)
  if (trackingNum && receiptInfo.receiptNum) {
    Logger.log(trackingNum)
    setTrackingNum(sheet, receiptInfo.receiptNum, trackingNum)
  } else {
    Logger.log('Error submitting receipt: ')
    Logger.log(receiptInfo)
  }
}

function testSubmitFromSheet() {
  var sheet = SpreadsheetApp.getActiveSheet()
  const receipts = getReceiptInfoFromSheet(sheet)
  //Logger.log(receipts)
  submitFromSheet(sheet, receipts[1])
}

function submitAllFromSheet() {
  var sheet = SpreadsheetApp.getActiveSheet()
  const receipts = getReceiptInfoFromSheet(sheet)
  receipts.forEach(receipt => {
    submitFromSheet(sheet, receipt)
  })
}

function getReceiptInfoFromSheet(sheet: GoogleAppsScript.Spreadsheet.Sheet) {
  var sheet = SpreadsheetApp.getActiveSheet()
  var data = sheet.getDataRange().getDisplayValues()
  var headers = getHeaders(data)
  var receipts: ReceiptInfo[] = []
  // skip first row (headers)
  // For each row, create a receipt object
  for (var i = 1; i < data.length; i++) {
    var receipt = data[i].reduce<ReceiptInfo>((cols, col, x) => {
      return { ...cols, [headers[x]]: col }
    }, {})
    receipts.push(receipt)
  }
  return receipts
}


// Get the row containing the specified value in a given column (starting at 1)
function getRowByColValue(data: SheetData, value: string, col: ColumnNumber): RowNumber | null {
  for (var i = 1; i < data.length; i++) {
    Logger.log('testing ' + data[i][col - 1] + ' == ' + value)
    if (data[i][col - 1] == value) {
      return i + 1
    }
  }
  Logger.log('Unable to find row for ' + value)
  return null
}

function getRowByTrackingNum(data: SheetData, trackingNum: string): RowNumber | null {
  const trackingNumCol = getColByHeader(data, TRACKING_NUM_HEADER)
  return getRowByColValue(data, trackingNum, trackingNumCol)
}

function getRowByReceiptNum(data: SheetData, receiptNum: string): RowNumber | null {
  const receiptNumCol = getColByHeader(data, RECEIPT_NUM_HEADER)
  return getRowByColValue(data, receiptNum, receiptNumCol)
}

function setTrackingNum(sheet: Sheet, receiptNum: string, trackingNum: string) {
  var data = sheet.getDataRange().getDisplayValues()
  var trackingNumCol = getColByHeader(data, TRACKING_NUM_HEADER)
  var row = getRowByReceiptNum(data, receiptNum)
  if (row) {
    var cell = sheet.getRange(row, trackingNumCol)
    cell.setValue(trackingNum)
  } else {
    Logger.log('Could not find receipt number ' + receiptNum)
  }
}

function setRead() {
  var m = GmailApp.getMessageById('181e4eeb7760843f')
  m.markUnread()
}

function getHeaders(data: SheetData) {
  return data[0]
}

function getColByHeader(data: SheetData, header: string): ColumnNumber {
  return getHeaders(data).indexOf(header) + 1
}