# Step 153 — Move MRP assumption SKU selection first (23 October 2026)

In the existing `MRP ASSUMPTIONS` tab (sheet ID 1206261005), moved SKU ID column from F to A using a native Sheets column move. The new order is: A SKU ID (manual dropdown), B Item, C Pack Size, D UOM, E Existing MRP IK (₹), F Existing MRP OK (₹), G Assumed MRP IK (₹) (manual), H Assumed MRP OK (₹) (manual). B:F remain formula-driven, displaying blue text; A/G/H remain standard colour and editable.

Verified Google Sheets automatically rewrote the five ARRAYFORMULA source lookups to use A2:A and preserved the SKU dropdown and positive-number validation. Both regional viability lookups automatically updated to reference assumption SKU keys in column A, and respective G/H regional assumed MRP. A temporary SKU ID 1 test correctly populated Abhayarishtam / 450 mL / ₹95 IK / ₹115 OK, and was removed afterward. No assumed MRP or commercial policy was changed.
