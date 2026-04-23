/**
 * JR Painting Calculator — Google Apps Script Backend
 * ===================================================
 * Read-only API: serves parts data from Google Sheet as JSON.
 *
 * SETUP:
 * 1. เปิด Google Sheet ที่มีข้อมูล parts (ใช้ CSV template ที่ import ไว้)
 * 2. ไปที่ Extensions > Apps Script
 * 3. ลบโค้ดเดิมทั้งหมด แล้ววางโค้ดนี้แทน
 * 4. กด Deploy > New deployment
 *    - Type: Web app
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 5. กด Deploy แล้วคัดลอก URL ที่ได้
 * 6. นำ URL ไปวางในหน้า Settings ของ JR Painting Calculator
 *
 * API ENDPOINTS:
 *   GET ?action=parts        → ข้อมูล parts ทั้งหมด
 *   GET ?action=models       → สรุป model sets
 *   GET ?action=health       → เช็คสถานะ API
 *   GET (no params)          → ข้อมูล parts ทั้งหมด (default)
 */

// ============ CONFIG ============
const SHEET_NAME = 'Sheet1'; // ชื่อ sheet ที่เก็บข้อมูล (เปลี่ยนได้ตามต้องการ)

// คอลัมน์ตัวเลข — จะถูกแปลงจาก string เป็น number อัตโนมัติ
const NUM_COLS = [
  'ratioPerSet','coverArea1side_mm2','specificGravity','filmThickness_um',
  'transferEff1_pct','transferEff2_pct','manualGunQty','manualGunOutput_gmin',
  'autoGunPerSide','strokeSpeed_mmin','reciproAdd_cm','overlapRatio',
  'recycleRate_pct','wpWidth_mm','wpLong_mm','wpDepth_mm','maxHangLong_m',
  'hanger1Long_m','hook1Long_m','hook2Long_m','hangColumn','hangRow',
  'pitch_m','lineSpeed_mmin','workingHours','powderPrice_THBkg',
  'loadingCT_sec','spray1CT_sec','spray2CT_sec','unloadingCT_sec',
  'surfaceInsp','airBlow','afterCoatingInsp','screen'
];

// ============ MAIN ENTRY ============
function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || 'parts';

  try {
    let result;
    switch (action) {
      case 'parts':
        result = getParts();
        break;
      case 'models':
        result = getModels();
        break;
      case 'health':
        result = getHealth();
        break;
      default:
        result = getParts();
    }
    return jsonResponse({ success: true, data: result });
  } catch (err) {
    return jsonResponse({ success: false, error: err.message }, 500);
  }
}

// ============ API HANDLERS ============

/**
 * ดึงข้อมูล parts ทั้งหมดจาก Sheet
 */
function getParts() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error('Sheet "' + SHEET_NAME + '" not found');

  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];

  const headers = data[0].map(function(h) { return String(h).trim(); });
  const parts = [];

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    // ข้าม row ที่ว่าง (เช็คจากคอลัมน์ id)
    if (!row[0] || String(row[0]).trim() === '') continue;

    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      var key = headers[j];
      var val = row[j];

      if (NUM_COLS.indexOf(key) !== -1) {
        obj[key] = typeof val === 'number' ? val : (parseFloat(val) || 0);
      } else {
        obj[key] = String(val).trim();
      }
    }
    parts.push(obj);
  }

  return parts;
}

/**
 * สรุป model sets — จัดกลุ่มตาม setModel
 */
function getModels() {
  const parts = getParts();
  const map = {};

  parts.forEach(function(p) {
    var key = p.setModel || p.model;
    if (!map[key]) {
      map[key] = {
        model: key,
        powderType: p.powderType,
        supplier: p.supplier,
        parts: []
      };
    }
    map[key].parts.push({
      id: p.id,
      description: p.description,
      partNo: p.partNo,
      ratioPerSet: p.ratioPerSet
    });
  });

  var models = [];
  for (var k in map) {
    if (map.hasOwnProperty(k)) {
      var ms = map[k];
      ms.pcsPerSet = ms.parts.reduce(function(s, p) { return s + p.ratioPerSet; }, 0);
      models.push(ms);
    }
  }
  return models;
}

/**
 * Health check — ใช้เช็คว่า API ทำงานปกติ
 */
function getHealth() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  const rowCount = sheet ? sheet.getLastRow() - 1 : 0;
  return {
    status: 'ok',
    sheet: SHEET_NAME,
    partsCount: rowCount,
    timestamp: new Date().toISOString()
  };
}

// ============ HELPERS ============

function jsonResponse(obj, statusCode) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============ TEST FUNCTION ============
// รันใน Apps Script Editor เพื่อทดสอบ
function testGetParts() {
  var parts = getParts();
  Logger.log('Total parts: ' + parts.length);
  if (parts.length > 0) {
    Logger.log('First part: ' + JSON.stringify(parts[0]));
  }
}
