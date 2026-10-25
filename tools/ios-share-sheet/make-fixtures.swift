// Synthetic images only; macOS AppKit/ImageIO, with no third-party dependencies.
import AppKit
import ImageIO
import UniformTypeIdentifiers

guard CommandLine.arguments.count == 2 else {
  fatalError("Usage: swift make-fixtures.swift OUTPUT_DIRECTORY")
}
let directory = URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true)
try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)

let fixtures: [(String, String, Int, Int, UTType)] = [
  ("A-landscape", "A — LANDSCAPE JPEG", 1600, 1000, .jpeg),
  ("B-portrait", "B — PORTRAIT HEIC", 1200, 1800, .heic),
  ("C-large", "C — LARGE JPEG", 4032, 3024, .jpeg),
]

for (name, label, width, height, type) in fixtures {
  guard let context = CGContext(
    data: nil, width: width, height: height, bitsPerComponent: 8,
    bytesPerRow: width * 4, space: CGColorSpace(name: CGColorSpace.sRGB)!,
    bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
  ) else { fatalError("Cannot create fixture context") }
  let w = CGFloat(width)
  let h = CGFloat(height)
  let scale = w / 1200
  context.setFillColor(CGColor(red: 0.08, green: 0.19, blue: 0.30, alpha: 1))
  context.fill(CGRect(x: 0, y: 0, width: w, height: h))
  // Distinct corners expose rotation, mirroring and accidental cropping.
  let corners: [(CGFloat, CGFloat, CGColor)] = [
    (0, h * 0.8, CGColor(red: 0.9, green: 0.3, blue: 0.2, alpha: 1)),
    (w * 0.8, h * 0.8, CGColor(red: 0.2, green: 0.7, blue: 0.5, alpha: 1)),
    (0, 0, CGColor(red: 0.3, green: 0.5, blue: 0.9, alpha: 1)),
    (w * 0.8, 0, CGColor(red: 0.9, green: 0.7, blue: 0.2, alpha: 1)),
  ]
  for (x, y, color) in corners {
    context.setFillColor(color)
    context.fill(CGRect(x: x, y: y, width: w * 0.2, height: h * 0.2))
  }
  NSGraphicsContext.saveGraphicsState()
  NSGraphicsContext.current = NSGraphicsContext(cgContext: context, flipped: false)
  let lines: [(String, CGFloat, CGFloat)] = [
    ("TOP ↑", h * 0.84, 90),
    (label, h * 0.56, 55),
    ("\(width) × \(height)", h * 0.43, 50),
    ("DAYFRAME — SYNTHETIC TEST", h * 0.30, 36),
    ("BOTTOM", h * 0.07, 50),
  ]
  for (line, y, size) in lines {
    let attributes: [NSAttributedString.Key: Any] = [
      .font: NSFont.boldSystemFont(ofSize: size * scale),
      .foregroundColor: NSColor.white,
    ]
    let text = line as NSString
    let extent = text.size(withAttributes: attributes)
    text.draw(at: NSPoint(x: (w - extent.width) / 2, y: y), withAttributes: attributes)
  }
  NSGraphicsContext.restoreGraphicsState()
  guard let image = context.makeImage() else { fatalError("Cannot render fixture") }
  let url = directory.appendingPathComponent(name).appendingPathExtension(type.preferredFilenameExtension!)
  guard let destination = CGImageDestinationCreateWithURL(url as CFURL, type.identifier as CFString, 1, nil)
  else { fatalError("Encoder unavailable for \(type.identifier)") }
  CGImageDestinationAddImage(destination, image, [kCGImageDestinationLossyCompressionQuality: 0.9] as CFDictionary)
  guard CGImageDestinationFinalize(destination) else { fatalError("Cannot write fixture") }
  print("Wrote \(url.path)")
}
