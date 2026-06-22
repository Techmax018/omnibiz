import json


def build_etims_payload(sale_invoice: dict) -> str:
    """Build a minimal eTIMS-ready payload for a sale invoice."""
    payload = {
        'invoice_number': sale_invoice.get('invoice_number'),
        'date': sale_invoice.get('created_at'),
        'customer': {
            'name': sale_invoice.get('customer_name'),
            'phone': sale_invoice.get('customer_phone'),
        },
        'line_items': [
            {
                'description': item.get('description'),
                'quantity': str(item.get('quantity')),
                'unit_price': str(item.get('unit_price')),
                'vat_rate': item.get('vat_rate'),
                'item_code': item.get('item_code'),
                'hs_code': item.get('hs_code'),
                'total_amount': str(item.get('total_amount')),
            }
            for item in sale_invoice.get('line_items', [])
        ],
        'total_amount': str(sale_invoice.get('total_amount')),
        'paid_amount': str(sale_invoice.get('paid_amount')),
        'outstanding_amount': str(sale_invoice.get('outstanding_amount')),
    }
    return json.dumps(payload)


def sign_etims_payload(payload: str) -> str:
    """Stub for a digital signing service used by eTIMS payloads."""
    return f"SIGNED:{payload}"
