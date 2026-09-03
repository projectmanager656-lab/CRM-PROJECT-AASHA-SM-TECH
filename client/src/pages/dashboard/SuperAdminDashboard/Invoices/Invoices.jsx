import AdminResourceManager from '../../AdminDashboard/components/AdminResourceManager';
import SuperAdminLayout from '../components/SuperAdminLayout';

const fields = [
  { name: 'user', label: 'Employee', type: 'user', required: true },
  { name: 'invoiceNumber', label: 'Invoice Number', required: true },
  { name: 'clientName', label: 'Client Name', required: true },
  { name: 'mobileNo', label: 'Mobile No', type: 'text' },
  { name: 'gstin', label: 'GSTIN', type: 'text' },
  { name: 'address', label: 'Address', type: 'textarea' },
  { name: 'issueDate', label: 'Invoice Date', type: 'date', required: true },
  { name: 'dueDate', label: 'Due Date', type: 'date' },
  { name: 'amount', label: 'Amount', type: 'number', required: true },
  { name: 'cgst', label: 'CGST (9%)', type: 'number' },
  { name: 'sgst', label: 'SGST (9%)', type: 'number' },
  { name: 'qty', label: 'Quantity', type: 'number', defaultValue: 1 },
  { name: 'status', label: 'Status', type: 'select', options: ['Draft', 'Sent', 'Paid', 'Overdue', 'Cancelled'], defaultValue: 'Sent' },
  { name: 'description', label: 'Description', type: 'textarea' }
];

const columns = [
  { key: 'invoiceNumber', label: 'Invoice Number' },
  { key: 'clientName', label: 'Client' },
  { key: 'amount', label: 'Amount' },
  { key: 'status', label: 'Status' },
  { key: 'issueDate', label: 'Issue Date', format: v => new Date(v).toLocaleDateString() }
];

// Utility function to convert numbers to words (simple version for INR)
function numberToWords(num) {
  if (num === 0) return 'Zero Rupees Only';
  const a = ['','One ','Two ','Three ','Four ', 'Five ','Six ','Seven ','Eight ','Nine ','Ten ','Eleven ','Twelve ','Thirteen ','Fourteen ','Fifteen ','Sixteen ','Seventeen ','Eighteen ','Nineteen '];
  const b = ['', '', 'Twenty','Thirty','Forty','Fifty', 'Sixty','Seventy','Eighty','Ninety'];

  if ((num = num.toString()).length > 9) return 'overflow';
  let n = ('000000000' + num).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
  if (!n) return; let str = '';
  str += (n[1] != 0) ? (a[Number(n[1])] || b[n[1][0]] + ' ' + a[n[1][1]]) + 'Crore ' : '';
  str += (n[2] != 0) ? (a[Number(n[2])] || b[n[2][0]] + ' ' + a[n[2][1]]) + 'Lakh ' : '';
  str += (n[3] != 0) ? (a[Number(n[3])] || b[n[3][0]] + ' ' + a[n[3][1]]) + 'Thousand ' : '';
  str += (n[4] != 0) ? (a[Number(n[4])] || b[n[4][0]] + ' ' + a[n[4][1]]) + 'Hundred ' : '';
  str += (n[5] != 0) ? ((str != '') ? 'and ' : '') + (a[Number(n[5])] || b[n[5][0]] + ' ' + a[n[5][1]]) + 'Rupees Only' : 'Rupees Only';
  return str;
}

const downloadPdfAction = (record) => (
  <button type="button" className="action-btn view" onClick={() => {
    const w = window.open('', '_blank');
    
    // Calculate totals
    const amount = Number(record.amount) || 0;
    const cgst = Number(record.cgst) || 0;
    const sgst = Number(record.sgst) || 0;
    const totalAmount = amount + cgst + sgst;
    const amountInWords = numberToWords(totalAmount);
    
    const qty = record.qty || 1;
    const pricePerUnit = (amount / qty).toFixed(2);
    
    // Format dates
    const formatDate = (dateStr) => {
        if (!dateStr) return '____/____/____';
        const d = new Date(dateStr);
        return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth()+1).toString().padStart(2, '0')}/${d.getFullYear()}`;
    };

    w.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Invoice ${record.invoiceNumber}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            color: #333;
            margin: 0;
            padding: 40px;
            font-size: 13px;
          }
          .container {
            max-width: 800px;
            margin: 0 auto;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 30px;
          }
          .logo-area {
            width: 150px;
          }
          .logo-area img {
            max-width: 100%;
            height: auto;
          }
          .company-details {
            text-align: right;
          }
          .company-name {
            font-size: 18px;
            font-weight: bold;
            margin: 0 0 5px 0;
          }
          .company-info {
            font-size: 11px;
            line-height: 1.4;
            color: #555;
            margin: 0;
          }
          .invoice-title {
            text-align: center;
            font-size: 20px;
            font-weight: bold;
            letter-spacing: 2px;
            border-top: 1px solid #000;
            border-bottom: 1px solid #000;
            padding: 10px 0;
            margin-bottom: 30px;
          }
          
          .details-section {
            display: flex;
            justify-content: space-between;
            margin-bottom: 20px;
          }
          
          .client-details table {
            border-collapse: collapse;
          }
          .client-details td {
            padding: 4px 8px 4px 0;
            vertical-align: top;
          }
          .client-details td:first-child {
            color: #0056b3;
          }
          .client-details td:nth-child(2) {
            padding-right: 5px;
          }
          .client-details .underline {
            border-bottom: 1px solid #000;
            width: 250px;
            display: inline-block;
          }
          
          .invoice-meta {
            text-align: right;
          }
          .invoice-meta table {
            margin-left: auto;
            border-collapse: collapse;
          }
          .invoice-meta td {
            padding: 4px 0 4px 8px;
            font-weight: bold;
          }
          
          .items-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
          }
          .items-table th {
            background-color: #a4c2f4;
            color: #000;
            text-align: left;
            padding: 8px;
            font-weight: bold;
            border: none;
          }
          .items-table td {
            padding: 10px 8px;
            border-bottom: 1px solid #ddd;
          }
          .items-table td:nth-child(2) { /* Description column */
             color: #0056b3;
             min-width: 200px;
          }
          .items-table .line {
             border-bottom: 1px solid #0056b3;
             display: inline-block;
             width: 100%;
             min-height: 15px;
          }
          .items-table .line-black {
             border-bottom: 1px solid #000;
             display: inline-block;
             width: 60px;
             text-align: center;
          }
          
          .totals-section {
            display: flex;
            justify-content: space-between;
            margin-top: 30px;
            margin-bottom: 40px;
          }
          
          .amount-words {
            width: 60%;
          }
          .amount-words-title {
            font-weight: bold;
            margin-bottom: 10px;
          }
          .amount-words-line {
            border-bottom: 1px solid #000;
            width: 100%;
            min-height: 20px;
            margin-bottom: 5px;
          }
          
          .totals-table {
            width: 35%;
            border-collapse: collapse;
          }
          .totals-table td {
            padding: 5px;
          }
          .totals-table td:first-child {
            text-align: left;
          }
          .totals-table td:last-child {
            text-align: right;
          }
          .totals-table .border-bottom {
             border-bottom: 1px solid #000;
          }
          .totals-table .bold {
             font-weight: bold;
          }
          
          .footer {
             display: flex;
             justify-content: space-between;
             margin-top: 50px;
          }
          
          .bank-details {
             border-left: 3px solid #6fa8dc;
             padding-left: 10px;
             color: #0056b3;
             line-height: 1.6;
          }
          
          .signature {
             text-align: right;
             margin-top: 20px;
          }
          .signature-name {
             font-family: "Times New Roman", Times, serif;
             font-style: italic;
             font-size: 16px;
             margin-bottom: 5px;
          }
          .signature-title {
             font-size: 11px;
          }
          
          .system-generated {
             background-color: #a4c2f4;
             color: #777;
             text-align: center;
             padding: 5px;
             font-size: 10px;
             margin-top: 30px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <!-- Header -->
          <div class="header">
            <div class="logo-area">
               <!-- Company Logo -->
               <img src="/aasha-logo-new.jpg" alt="AASHA-SM Logo" onerror="this.src='https://via.placeholder.com/150x50?text=Logo'"/>
            </div>
            <div class="company-details">
              <h2 class="company-name">AASHA-SM TECHNOLOGIES<br>PRIVATE LIMITED.</h2>
              <p class="company-info">
                CIN : U62099ME2026PTC474681<br>
                GSTIN: 27ABFCA5735P1Z4
              </p>
            </div>
          </div>
          
          <!-- Invoice Title -->
          <div class="invoice-title">INVOICE</div>
          
          <!-- Details Section -->
          <div class="details-section">
            <div class="client-details">
               <div style="font-weight:bold; color:#000; margin-bottom:10px;">Invoice to</div>
               <table>
                  <tr>
                     <td>Client Name</td>
                     <td>:</td>
                     <td><span class="underline">${record.clientName || ''}</span></td>
                  </tr>
                  <tr>
                     <td>Mobile No</td>
                     <td>:</td>
                     <td><span class="underline">${record.mobileNo || ''}</span></td>
                  </tr>
                  <tr>
                     <td>GSTIN</td>
                     <td>:</td>
                     <td><span class="underline">${record.gstin || ''}</span></td>
                  </tr>
                  <tr>
                     <td style="padding-top:10px;">Address</td>
                     <td style="padding-top:10px;">:</td>
                     <td style="padding-top:10px;"><span class="underline" style="width: 350px;">${record.address || ''}</span></td>
                  </tr>
               </table>
            </div>
            <div class="invoice-meta">
               <table>
                  <tr>
                     <td>Invoice No:</td>
                     <td>${record.invoiceNumber}</td>
                  </tr>
                  <tr>
                     <td>Invoice Date:</td>
                     <td>${formatDate(record.issueDate)}</td>
                  </tr>
               </table>
            </div>
          </div>
          
          <!-- Items Table -->
          <table class="items-table">
            <thead>
               <tr>
                  <th style="width: 5%;">No.</th>
                  <th style="width: 50%;">Description</th>
                  <th style="width: 15%; text-align:center;">Price (₹)</th>
                  <th style="width: 10%; text-align:center;">QTY</th>
                  <th style="width: 20%; text-align:right;">Amount (₹)</th>
               </tr>
            </thead>
            <tbody>
               <tr>
                  <td>1</td>
                  <td><span class="line">${record.description || ''}</span></td>
                  <td style="text-align:center;"><span class="line-black">${pricePerUnit}</span></td>
                  <td style="text-align:center;"><span class="line-black">${qty}</span></td>
                  <td style="text-align:right;"><span class="line-black">${amount.toFixed(2)}</span></td>
               </tr>
               <tr>
                  <td>2</td>
                  <td><span class="line"></span></td>
                  <td style="text-align:center;"><span class="line-black"></span></td>
                  <td style="text-align:center;"><span class="line-black"></span></td>
                  <td style="text-align:right;"><span class="line-black"></span></td>
               </tr>
            </tbody>
          </table>
          <div style="border-top: 1px solid #ddd; margin-bottom: 20px;"></div>
          
          <!-- Totals Section -->
          <div class="totals-section">
             <div class="amount-words">
                <div class="amount-words-title">Total Amount (In Words):</div>
                <div class="amount-words-line">${amountInWords}</div>
                <div class="amount-words-line"></div>
             </div>
             
             <table class="totals-table">
                <tr>
                   <td>Sub Total :</td>
                   <td>₹ <span style="display:inline-block; width:60px; border-bottom:1px solid #000;">${amount.toFixed(2)}</span></td>
                </tr>
                <tr>
                   <td>CGST (9%):</td>
                   <td>₹ <span style="display:inline-block; width:60px; border-bottom:1px solid #000;">${cgst.toFixed(2)}</span></td>
                </tr>
                <tr>
                   <td>SGST (9%):</td>
                   <td>₹ <span style="display:inline-block; width:60px; border-bottom:1px solid #000;">${sgst.toFixed(2)}</span></td>
                </tr>
                <tr><td colspan="2" style="padding:0;"><div style="border-bottom:1px solid #000; margin:5px 0;"></div></td></tr>
                <tr class="bold">
                   <td>Total Invoice Amount</td>
                   <td>₹ <span style="display:inline-block; width:60px; border-bottom:1px solid #000;">${totalAmount.toFixed(2)}</span></td>
                </tr>
             </table>
          </div>
          
          <!-- Footer -->
          <div class="footer">
             <div class="bank-details">
                Bank Name : AXIS BANK<br>
                Account No : 92502053750495<br>
                IFSC Code  : UTIB0002910
             </div>
             <div class="signature">
                <div class="signature-name">Wattamwar Sejal<br>Sachin</div>
                <div class="signature-title">Authorized Signature</div>
             </div>
          </div>
          
          <div class="system-generated">
             This is a system generated invoice
          </div>
          
        </div>
        <script>window.onload = function() { window.print(); }</script>
      </body>
      </html>
    `);
    w.document.close();
  }}>PDF</button>
);

const transformSubmit = (form) => ({ 
  ...form, 
  amount: Number(form.amount) || 0,
  cgst: Number(form.cgst) || 0,
  sgst: Number(form.sgst) || 0,
  qty: Number(form.qty) || 1
});

export default function Invoices() {
  return (
    <AdminResourceManager
      title="Invoices"
      singular="Invoice"
      endpoint="/invoices"
      fields={fields}
      columns={columns}
      transformSubmit={transformSubmit}
      extraActions={downloadPdfAction}
      Layout={SuperAdminLayout}
    />
  );
}
