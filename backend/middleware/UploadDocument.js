import multer from "multer";
import path from "path";
import fs from "fs";

const uploadDir = "uploads/documents";

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const baseName = path.basename(file.originalname, ext).replace(/\s+/g, "_");
    cb(null, `${Date.now()}-${baseName}${ext}`);
  },
});

const allowedExtensions = [".pdf", ".xls", ".xlsx", ".doc", ".docx"];
const allowedMimeTypes = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

const fileFilter = function (req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  const mime = file.mimetype;

  if (allowedExtensions.includes(ext) && allowedMimeTypes.includes(mime)) {
    return cb(null, true);
  }

  cb(new Error("Only PDF, XLS, XLSX, DOC, and DOCX files are allowed"));
};

const uploadDocument = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

export default uploadDocument;