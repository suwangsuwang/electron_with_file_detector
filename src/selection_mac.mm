#include "selection.hpp"
#include <ApplicationServices/ApplicationServices.h>
#include <Cocoa/Cocoa.h>
#include <optional>
#include <string>

namespace selection_impl {

void Initialize() {}

bool CheckAccessibilityPermissions(bool prompt) {
  if (prompt) {
    // Request accessibility permissions
    AXIsProcessTrusted();
  }
  return AXIsProcessTrusted();
}

selection_impl::Selection GetSelection() {
  selection_impl::Selection result;
  result.text = "";

  // Get the current selection from the system clipboard
  NSPasteboard *pasteboard = [NSPasteboard generalPasteboard];
  NSString *string = [pasteboard stringForType:NSPasteboardTypeString];

  if (string) {
    result.text = [string UTF8String];
  }

  return result;
}

} // namespace selection_impl
