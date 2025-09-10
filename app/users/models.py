from app.database import Base
from sqlalchemy import Column, Integer, String, Date, ForeignKey, Boolean
from sqlalchemy.orm import relationship



class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    username = Column(String(50), unique=True)
    hashed_password = Column(String, nullable=False)
    # store multiple roles as comma-separated values, e.g. "bar,restaurant"
    roles = Column(String(200), default="user")      