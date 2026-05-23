"""Email notification service using Resend."""
from typing import List, Optional
import resend
from app.config import get_settings

settings = get_settings()


class EmailService:
    """Email notifications for attendance system."""
    
    def __init__(self):
        if settings.resend_api_key:
            resend.api_key = settings.resend_api_key
    
    async def send_absence_notification(
        self,
        student_email: str,
        student_name: str,
        course_name: str,
        absence_date: str
    ) -> bool:
        """Send absence notification to student."""
        if not settings.resend_api_key:
            return False
        
        try:
            html_content = f"""
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); padding: 30px; text-align: center;">
                    <h1 style="color: white; margin: 0;">Vision Attend</h1>
                </div>
                <div style="padding: 30px; background: #f9fafb;">
                    <h2 style="color: #1f2937;">Absence Notification</h2>
                    <p style="color: #4b5563;">Dear {student_name},</p>
                    <p style="color: #4b5563;">
                        This is to inform you that you were marked <strong style="color: #EF4444;">absent</strong> 
                        for the following class:
                    </p>
                    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <p><strong>Course:</strong> {course_name}</p>
                        <p><strong>Date:</strong> {absence_date}</p>
                    </div>
                    <p style="color: #4b5563;">
                        If you believe this is an error, please contact your faculty immediately.
                    </p>
                </div>
                <div style="background: #1f2937; padding: 20px; text-align: center;">
                    <p style="color: #9ca3af; font-size: 12px;">
                        Vision Attend - Automated Attendance System
                    </p>
                </div>
            </div>
            """
            
            resend.Emails.send({
                "from": settings.from_email,
                "to": student_email,
                "subject": f"Absence Alert: {course_name} - {absence_date}",
                "html": html_content
            })
            
            return True
        except Exception as e:
            print(f"Email send error: {e}")
            return False
    
    async def send_daily_report(
        self,
        faculty_email: str,
        faculty_name: str,
        course_name: str,
        report_date: str,
        present_count: int,
        late_count: int,
        absent_count: int,
        absent_students: List[str]
    ) -> bool:
        """Send daily attendance report to faculty."""
        if not settings.resend_api_key:
            return False
        
        try:
            absent_list = "".join([f"<li>{name}</li>" for name in absent_students]) if absent_students else "<li>None</li>"
            
            html_content = f"""
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); padding: 30px; text-align: center;">
                    <h1 style="color: white; margin: 0;">Daily Attendance Report</h1>
                </div>
                <div style="padding: 30px; background: #f9fafb;">
                    <p style="color: #4b5563;">Dear {faculty_name},</p>
                    <p style="color: #4b5563;">Here is the attendance summary for {course_name} on {report_date}:</p>
                    
                    <div style="display: flex; gap: 15px; margin: 20px 0;">
                        <div style="flex: 1; background: #10B981; padding: 20px; border-radius: 8px; text-align: center;">
                            <h3 style="color: white; margin: 0;">{present_count}</h3>
                            <p style="color: white; margin: 5px 0 0;">Present</p>
                        </div>
                        <div style="flex: 1; background: #F59E0B; padding: 20px; border-radius: 8px; text-align: center;">
                            <h3 style="color: white; margin: 0;">{late_count}</h3>
                            <p style="color: white; margin: 5px 0 0;">Late</p>
                        </div>
                        <div style="flex: 1; background: #EF4444; padding: 20px; border-radius: 8px; text-align: center;">
                            <h3 style="color: white; margin: 0;">{absent_count}</h3>
                            <p style="color: white; margin: 5px 0 0;">Absent</p>
                        </div>
                    </div>
                    
                    <h3 style="color: #1f2937;">Absent Students:</h3>
                    <ul style="color: #4b5563;">{absent_list}</ul>
                </div>
            </div>
            """
            
            resend.Emails.send({
                "from": settings.from_email,
                "to": faculty_email,
                "subject": f"Attendance Report: {course_name} - {report_date}",
                "html": html_content
            })
            
            return True
        except Exception as e:
            print(f"Email send error: {e}")
            return False
    
    async def send_password_reset_email(
        self,
        email: str,
        reset_link: str
    ) -> bool:
        """Send password reset email."""
        # Always log to console for local testing
        print(f"\n{'='*50}")
        print(f"📧 PASSWORD RESET LINK for {email}:")
        print(f"🔗 {reset_link}")
        print(f"{'='*50}\n")
        
        if not settings.resend_api_key:
            print("⚠️ Resend API key not configured - email not sent")
            return True  # Return True since we logged the link
        
        try:
            html_content = f"""
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); padding: 30px; text-align: center;">
                    <h1 style="color: white; margin: 0;">Vision Attend</h1>
                </div>
                <div style="padding: 30px; background: #f9fafb;">
                    <h2 style="color: #1f2937;">Password Reset Request</h2>
                    <p style="color: #4b5563;">
                        You have requested to reset your password. Click the button below to set a new password:
                    </p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="{reset_link}" 
                           style="background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); 
                                  color: white; 
                                  padding: 15px 30px; 
                                  text-decoration: none; 
                                  border-radius: 8px;
                                  font-weight: bold;">
                            Reset Password
                        </a>
                    </div>
                    <p style="color: #6b7280; font-size: 14px;">
                        This link will expire in 15 minutes.
                    </p>
                    <p style="color: #6b7280; font-size: 14px;">
                        If you didn't request this, please ignore this email.
                    </p>
                </div>
                <div style="background: #1f2937; padding: 20px; text-align: center;">
                    <p style="color: #9ca3af; font-size: 12px;">
                        Vision Attend - Automated Attendance System
                    </p>
                </div>
            </div>
            """
            
            resend.Emails.send({
                "from": settings.from_email,
                "to": email,
                "subject": "Password Reset - Vision Attend",
                "html": html_content
            })
            
            return True
        except Exception as e:
            print(f"Email send error: {e}")
            return True  # Still return True since we logged the link


email_service = EmailService()
