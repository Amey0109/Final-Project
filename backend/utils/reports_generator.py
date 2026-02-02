# utils/report_generator.py
import pandas as pd
import numpy as np
from io import BytesIO
import csv
import json
from datetime import datetime, date
from typing import List, Dict, Any, Optional

class ReportGenerator:
    def __init__(self, institute_name: str):
        self.institute_name = institute_name
    
    def generate_excel_report(self, data: List[Dict], stats: Dict, filters: Dict) -> BytesIO:
        """Generate Excel report for attendance data"""
        buffer = BytesIO()
        
        # Create DataFrame
        df = pd.DataFrame(data) if data else pd.DataFrame()
        
        if not df.empty:
            # Format columns if they exist
            if 'attendance_percentage' in df.columns:
                df['attendance_percentage'] = df['attendance_percentage'].apply(
                    lambda x: f"{float(x):.1f}%" if pd.notnull(x) else "0.0%"
                )
            
            # Format dates if they exist
            date_columns = ['last_attendance', 'attendance_date', 'created_at']
            for col in date_columns:
                if col in df.columns:
                    df[col] = pd.to_datetime(df[col], errors='coerce').dt.strftime('%Y-%m-%d')
        
        # Create Excel writer
        with pd.ExcelWriter(buffer, engine='openpyxl') as writer:
            # Write main data
            df.to_excel(writer, sheet_name='Attendance Report', index=False)
            
            # Create summary sheet
            summary_data = {
                'Metric': ['Institute Name', 'Total Students', 'Average Attendance', 
                          'Present Count', 'Absent Count', 'Total Days',
                          'Report Period', 'Generated At', 'Class Filter', 'Stream Filter'],
                'Value': [
                    self.institute_name,
                    stats.get('total_students', 0),
                    f"{stats.get('average_attendance', 0):.1f}%",
                    stats.get('present_count', 0),
                    stats.get('absent_count', 0),
                    stats.get('total_days', 0),
                    f"{filters.get('start_date', 'N/A')} to {filters.get('end_date', 'N/A')}",
                    datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                    filters.get('class_filter', 'All'),
                    filters.get('stream_filter', 'All')
                ]
            }
            summary_df = pd.DataFrame(summary_data)
            summary_df.to_excel(writer, sheet_name='Summary', index=False)
        
        buffer.seek(0)
        return buffer
    
    def generate_html_report(self, data: List[Dict], stats: Dict, filters: Dict) -> BytesIO:
        """Generate HTML report for attendance data"""
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <title>Attendance Report - {self.institute_name}</title>
            <style>
                body {{
                    font-family: Arial, sans-serif;
                    margin: 20px;
                    color: #333;
                }}
                .header {{
                    text-align: center;
                    margin-bottom: 30px;
                    padding: 20px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    border-radius: 8px;
                }}
                .title {{
                    font-size: 28px;
                    font-weight: bold;
                    margin-bottom: 5px;
                }}
                .subtitle {{
                    font-size: 14px;
                    opacity: 0.9;
                }}
                .stats-grid {{
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 15px;
                    margin: 25px 0;
                }}
                .stat-card {{
                    background: white;
                    padding: 20px;
                    border-radius: 8px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                    text-align: center;
                    border-top: 4px solid #667eea;
                }}
                .stat-value {{
                    font-size: 24px;
                    font-weight: bold;
                    color: #667eea;
                    margin: 10px 0;
                }}
                .stat-label {{
                    color: #666;
                    font-size: 14px;
                }}
                .filters {{
                    background: #f8f9fa;
                    padding: 15px;
                    border-radius: 6px;
                    margin: 20px 0;
                    font-size: 14px;
                }}
                table {{
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 20px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                }}
                th {{
                    background: #667eea;
                    color: white;
                    padding: 15px;
                    text-align: left;
                    font-weight: bold;
                }}
                td {{
                    padding: 12px 15px;
                    border-bottom: 1px solid #e0e0e0;
                }}
                tr:hover {{
                    background-color: #f5f5f5;
                }}
                .attendance-low {{ color: #e74c3c; font-weight: bold; }}
                .attendance-medium {{ color: #f39c12; font-weight: bold; }}
                .attendance-high {{ color: #27ae60; font-weight: bold; }}
                .footer {{
                    margin-top: 40px;
                    text-align: center;
                    color: #7f8c8d;
                    font-size: 12px;
                    padding: 20px;
                    border-top: 1px solid #ecf0f1;
                }}
            </style>
        </head>
        <body>
            <div class="header">
                <div class="title">Attendance Report</div>
                <div class="subtitle">{self.institute_name}</div>
                <div class="subtitle">Generated on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</div>
            </div>
            
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-label">Total Students</div>
                    <div class="stat-value">{stats.get('total_students', 0)}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Average Attendance</div>
                    <div class="stat-value">{stats.get('average_attendance', 0):.1f}%</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Present Days</div>
                    <div class="stat-value">{stats.get('present_count', 0)}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Absent Students</div>
                    <div class="stat-value">{stats.get('absent_count', 0)}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Total Days</div>
                    <div class="stat-value">{stats.get('total_days', 0)}</div>
                </div>
            </div>
            
            <div class="filters">
                <strong>Filters Applied:</strong><br/>
                • Class: {filters.get('class_filter', 'All')}<br/>
                • Stream: {filters.get('stream_filter', 'All')}<br/>
                • Date Range: {filters.get('start_date', 'N/A')} to {filters.get('end_date', 'N/A')}
            </div>
        """
        
        if data:
            html_content += """
            <table>
                <thead>
                    <tr>
                        <th>Roll No</th>
                        <th>Student Name</th>
                        <th>Class</th>
                        <th>Stream</th>
                        <th>Attendance %</th>
                        <th>Present Days</th>
                        <th>Total Days</th>
                        <th>Last Attendance</th>
                    </tr>
                </thead>
                <tbody>
            """
            
            for record in data:
                attendance_pct = 0
                try:
                    attendance_pct = float(record.get('attendance_percentage', 0))
                except (ValueError, TypeError):
                    attendance_pct = 0
                
                status_class = "attendance-high"
                if attendance_pct < 50:
                    status_class = "attendance-low"
                elif attendance_pct < 75:
                    status_class = "attendance-medium"
                
                last_attendance = record.get('last_attendance', '')
                if last_attendance:
                    try:
                        if isinstance(last_attendance, (date, datetime)):
                            last_attendance = last_attendance.strftime('%Y-%m-%d')
                        elif isinstance(last_attendance, str):
                            try:
                                dt = datetime.fromisoformat(last_attendance.replace('Z', '+00:00'))
                                last_attendance = dt.strftime('%Y-%m-%d')
                            except:
                                pass
                    except:
                        pass
                
                html_content += f"""
                    <tr>
                        <td>{record.get('roll_no', '')}</td>
                        <td>{record.get('student_name', '')}</td>
                        <td>{record.get('class_name', 'N/A')}</td>
                        <td>{record.get('stream', 'N/A')}</td>
                        <td class="{status_class}">{attendance_pct:.1f}%</td>
                        <td>{record.get('present_days', 0)}</td>
                        <td>{record.get('total_days', 0)}</td>
                        <td>{last_attendance}</td>
                    </tr>
                """
            
            html_content += """
                </tbody>
            </table>
            """
        else:
            html_content += """
            <div style="text-align: center; padding: 40px; color: #7f8c8d;">
                <h3>No data available for the selected filters</h3>
                <p>Try adjusting your filter criteria</p>
            </div>
            """
        
        html_content += """
            <div class="footer">
                <p>Generated by NeuroFace AI Attendance System</p>
                <p>© 2026 All Rights Reserved</p>
            </div>
        </body>
        </html>
        """
        
        # Convert HTML string to BytesIO
        buffer = BytesIO(html_content.encode('utf-8'))
        buffer.seek(0)
        return buffer
    
    def generate_pdf_report(self, data: List[Dict], stats: Dict, filters: Dict) -> BytesIO:
        """Generate PDF report for attendance data"""
        try:
            # Try to import reportlab
            from reportlab.lib import colors
            from reportlab.lib.pagesizes import letter, landscape
            from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
            from reportlab.lib.styles import getSampleStyleSheet
            
            buffer = BytesIO()
            doc = SimpleDocTemplate(buffer, pagesize=landscape(letter))
            elements = []
            styles = getSampleStyleSheet()
            
            # Title
            title = Paragraph(f"{self.institute_name} - Attendance Report", styles['Title'])
            elements.append(title)
            elements.append(Spacer(1, 12))
            
            # Filters
            filters_text = f"""
            <b>Report Filters:</b><br/>
            Institute: {filters.get('institute_name', 'N/A')}<br/>
            Class: {filters.get('class_filter', 'All')}<br/>
            Stream: {filters.get('stream_filter', 'All')}<br/>
            Date Range: {filters.get('start_date', 'N/A')} to {filters.get('end_date', 'N/A')}<br/>
            Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
            """
            elements.append(Paragraph(filters_text, styles['Normal']))
            elements.append(Spacer(1, 12))
            
            # Statistics
            stats_text = f"""
            <b>Statistics:</b><br/>
            Total Students: {stats['total_students']}<br/>
            Average Attendance: {stats.get('average_attendance', 0):.1f}%<br/>
            Total Present Days: {stats.get('present_count', 0)}<br/>
            Students with Zero Attendance: {stats.get('absent_count', 0)}<br/>
            Report Period: {stats.get('total_days', 0)} days
            """
            elements.append(Paragraph(stats_text, styles['Normal']))
            elements.append(Spacer(1, 12))
            
            # Data table
            if data:
                table_data = [['Roll No', 'Student Name', 'Class', 'Stream', 'Attendance %', 'Present Days', 'Last Attendance']]
                
                for record in data:
                    attendance_pct = 0
                    try:
                        attendance_pct = float(record.get('attendance_percentage', 0))
                    except (ValueError, TypeError):
                        attendance_pct = 0
                    
                    last_attendance = record.get('last_attendance', '')
                    if last_attendance:
                        try:
                            if isinstance(last_attendance, (date, datetime)):
                                last_attendance = last_attendance.strftime('%Y-%m-%d')
                            elif isinstance(last_attendance, str):
                                try:
                                    dt = datetime.fromisoformat(last_attendance.replace('Z', '+00:00'))
                                    last_attendance = dt.strftime('%Y-%m-%d')
                                except:
                                    last_attendance = str(last_attendance)
                        except:
                            last_attendance = str(last_attendance)
                    
                    table_data.append([
                        str(record.get('roll_no', '')),
                        str(record.get('student_name', '')),
                        str(record.get('class_name', 'N/A')),
                        str(record.get('stream', 'N/A')),
                        f"{attendance_pct:.1f}%",
                        str(record.get('present_days', 0)),
                        str(last_attendance)
                    ])
                
                table = Table(table_data)
                table.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
                    ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                    ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                    ('FONTSIZE', (0, 0), (-1, 0), 10),
                    ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                    ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
                    ('GRID', (0, 0), (-1, -1), 1, colors.black)
                ]))
                elements.append(table)
            
            # Build PDF
            doc.build(elements)
            buffer.seek(0)
            return buffer
            
        except ImportError:
            # If reportlab is not installed, return a simple text PDF
            buffer = BytesIO()
            content = f"""
            {self.institute_name} - Attendance Report
            ========================================
            
            Report Filters:
            ---------------
            Institute: {filters.get('institute_name', 'N/A')}
            Class: {filters.get('class_filter', 'All')}
            Stream: {filters.get('stream_filter', 'All')}
            Date Range: {filters.get('start_date', 'N/A')} to {filters.get('end_date', 'N/A')}
            Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
            
            Statistics:
            -----------
            Total Students: {stats.get('total_students', 0)}
            Average Attendance: {stats.get('average_attendance', 0):.1f}%
            Total Present Days: {stats.get('present_count', 0)}
            Students with Zero Attendance: {stats.get('absent_count', 0)}
            Report Period: {stats.get('total_days', 0)} days
            
            Attendance Data:
            ---------------
            """
            
            if data:
                content += "\nRoll No | Student Name | Class | Stream | Attendance % | Present Days | Last Attendance\n"
                content += "-" * 100 + "\n"
                
                for record in data:
                    attendance_pct = 0
                    try:
                        attendance_pct = float(record.get('attendance_percentage', 0))
                    except (ValueError, TypeError):
                        attendance_pct = 0
                    
                    last_attendance = record.get('last_attendance', 'N/A')
                    if last_attendance and isinstance(last_attendance, (date, datetime)):
                        last_attendance = last_attendance.strftime('%Y-%m-%d')
                    
                    content += f"{record.get('roll_no', '')} | {record.get('student_name', '')} | {record.get('class_name', 'N/A')} | {record.get('stream', 'N/A')} | {attendance_pct:.1f}% | {record.get('present_days', 0)} | {last_attendance}\n"
            else:
                content += "\nNo data available for the selected filters\n"
            
            buffer.write(content.encode('utf-8'))
            buffer.seek(0)
            return buffer
    
    def generate_json_report(self, data: List[Dict], stats: Dict, filters: Dict) -> BytesIO:
        """Generate JSON report for attendance data"""
        report = {
            "institute": self.institute_name,
            "generated_at": datetime.now().isoformat(),
            "filters": filters,
            "statistics": stats,
            "data": data,
            "count": len(data)
        }
        
        # Convert dates to strings for JSON serialization
        def convert_dates(obj):
            if isinstance(obj, (date, datetime)):
                return obj.isoformat()
            elif isinstance(obj, dict):
                return {k: convert_dates(v) for k, v in obj.items()}
            elif isinstance(obj, list):
                return [convert_dates(item) for item in obj]
            return obj
        
        report = convert_dates(report)
        json_str = json.dumps(report, indent=2)
        
        # Convert JSON string to BytesIO
        buffer = BytesIO(json_str.encode('utf-8'))
        buffer.seek(0)
        return buffer
    
    def generate_report(self, data: List[Dict], stats: Dict, filters: Dict, format: str) -> tuple:
        """
        Generate report in specified format
        
        Returns: (content: BytesIO, content_type: str, filename: str)
        """
        filename = f"attendance_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        if format.lower() == 'excel':
            content = self.generate_excel_report(data, stats, filters)
            content_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            filename += ".xlsx"          
            
        elif format.lower() == 'html':
            content = self.generate_html_report(data, stats, filters)
            content_type = "text/html"
            filename += ".html"
            
        elif format.lower() == 'json':
            content = self.generate_json_report(data, stats, filters)
            content_type = "application/json"
            filename += ".json"
            
        elif format.lower() == 'pdf':
            content = self.generate_pdf_report(data, stats, filters)
            content_type = "application/pdf"
            filename += ".pdf"
            
        
        # Make sure content is BytesIO
        if not isinstance(content, BytesIO):
            # Convert to BytesIO if it's not already
            if isinstance(content, str):
                content = BytesIO(content.encode('utf-8'))
            elif isinstance(content, bytes):
                content = BytesIO(content)
            else:
                # Try to convert to bytes
                try:
                    content = BytesIO(str(content).encode('utf-8'))
                except:
                    raise ValueError(f"Cannot convert content to BytesIO for format: {format}")
        
        # Make sure all content is at position 0
        content.seek(0)
        
        return content, content_type, filename