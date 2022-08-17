const receipt_num_col = 3
const tracking_num_col = 5

function getReceiptInfoFromGmail() {
  //var receiptThreads = GmailApp.getUserLabelByName('Home Depot/Receipts').getThreads()
  var receiptThreads = GmailApp.search('label:home-depot-receipts-not-applied is:read')
  let receiptMessages = []
  receiptThreads.forEach((t) => {
    receiptMessages = [...receiptMessages, ...t.getMessages()]
  })
  Logger.log(receiptMessages.length)
  const numDateRe = /(\d{4}\s{2}\d{5}\s{2}\d{5})\s+(\d{2}\/\d{2}\/\d{2})/
  const totalRe = /\s*TOTAL\s+\$(\d+.\d{2})/
  const receiptsInfo = receiptMessages.reduce((receiptsInfo, message) => {
    const body = message.getPlainBody()
    const numDateMatch = body.match(numDateRe)
    const totalMatch = body.match(totalRe)
    if (totalMatch) {
      let receiptInfo = {
        messageId: message.getId(),
        receiptNum: numDateMatch ? numDateMatch[1].replace(/ /g, '') : null,
        date: numDateMatch ? numDateMatch[2] : null,
        total: totalMatch[1]
      }
      return [...receiptsInfo, receiptInfo]
    }
    return receiptsInfo
  }, [])
  return receiptsInfo
}

//TODO: check for error calling function
function submitReceipt(receiptData) {
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

function testCallFunction() {
  const receiptData = {
    date: '07/26/22',
    total: '8.19',
    receiptNum: '49410005243829'
  }
  const tracking = submitReceipt(receiptData)
  Logger.log(tracking)
}

function writeToSheet(receiptData) {
  var sheet = SpreadsheetApp.getActiveSheet()
  receiptData.forEach(row => {
    sheet.appendRow(row)
  })
}

function writeReceiptsToSheet() {
  const receipts = getReceiptInfoFromGmail()
  var sheet = SpreadsheetApp.getActiveSheet()
  sheet.clear()
  sheet.appendRow(['messageId', 'date', 'receiptNum', 'total'])
  receipts.forEach(receipt => {
    sheet.appendRow([receipt.messageId, receipt.date, receipt.receiptNum, receipt.total])
  })
}

function submitManyFromSheet() {

}

function submitFromSheet(sheet, receiptInfo) {
  Logger.log('submitting: ' + receiptInfo)
  const trackingNum = submitReceipt(receiptInfo)
  if (trackingNum) {
    Logger.log(trackingNum)
    setTrackingNum(sheet, receiptInfo.receiptNum, trackingNum)
  }
}

function testSubmitFromSheet() {
  var sheet = SpreadsheetApp.getActiveSheet()
  const receipts = getReceiptInfoFromSheet(sheet)
  //Logger.log(receipts)
  submitFromSheet(sheet, receipts[1])
}

function getReceiptInfoFromSheet(sheet: GoogleAppsScript.Spreadsheet.Sheet) {
  var sheet = SpreadsheetApp.getActiveSheet()
  var data = sheet.getDataRange().getDisplayValues()
  var headers = getHeaders(sheet)
  var receipts = []
  for (var i = 1; i < data.length; i++) {
    var row = data[i].reduce((cols, col, x) => {
      return { ...cols, [headers[x]]: col }
    }, {})
    receipts.push(row)
  }
  return receipts
}

function getHeaders(sheet) {
  var data = sheet.getDataRange().getDisplayValues()
  var headers = data[0]
  return headers
}

// Get the row containing the specified value in a given column (col index starts at 1)
function getRowByColValue(data, value, col) {
  for (var i = 1; i < data.length; i++) {
    Logger.log('testing ' + data[i][col - 1] + ' == ' + value)
    if (data[i][col - 1] == value) {
      return i + 1
    }
  }
  return null
}

function testGetRowByColValue() {
  var sheet = SpreadsheetApp.getActiveSheet()
  var col = 2
  const trackingNumCol = 4
  var row = getRowByColValue(sheet, col, '49410005124995')
  Logger.log(row)
  var r = sheet.getRange(row, trackingNumCol)
  //Logger.log(r.getDisplayValues())
  r.setValue('trackingtest')
}

function getRowByTrackingNum(data, trackingNum) {
  return getRowByColValue(data, trackingNum, tracking_num_col)
}

function getRowByReceiptNum(data, receiptNum) {
  return getRowByColValue(data, receiptNum, receipt_num_col)
}

function testGetRowByReceiptNum() {
  var sheet = SpreadsheetApp.getActiveSheet()
  var data = sheet.getDataRange().getDisplayValues()
  Logger.log(data)
  Logger.log(getRowByReceiptNum(data, 49070006255400))
}

function setTrackingNum(sheet, receiptNum, trackingNum) {
  var data = sheet.getDataRange().getDisplayValues()
  var row = getRowByReceiptNum(data, receiptNum)
  var cell = sheet.getRange(row, tracking_num_col)
  cell.setValue(trackingNum)
}

function setRead() {
  var m = GmailApp.getMessageById('181e4eeb7760843f')
  m.markUnread()
}