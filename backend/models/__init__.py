# Keep only ONE import for each model
from .users import User
from .institute import Institute
from .faculty import Faculty
from .student import Student
from .attendance import Attendance
from .faculty_class import FacultyClass
from .faculty_student import FacultyStudent

__all__ = ["User", "Institute", "Faculty", "Student", "Attendance", "FacultyClass", "FacultyStudent"]