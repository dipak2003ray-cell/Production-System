from sqlalchemy import Column, String, Index
from .base import Base, UUIDPrimaryKeyMixin, AuditMixin, SoftDeleteMixin

class Customer(Base, UUIDPrimaryKeyMixin, AuditMixin, SoftDeleteMixin):
    __tablename__ = "customer_master"

    code = Column(String(20), nullable=False, unique=True)
    name = Column(String(150), nullable=False)
    contact_person = Column(String(100), nullable=True)
    email = Column(String(100), nullable=True)
    phone = Column(String(30), nullable=True)
    state = Column(String(100), nullable=True) # Nullable at DB level per AR-04, validated during transactional sequences

# Performance indices
Index("idx_customer_code", Customer.code, unique=True)
Index("idx_customer_name", Customer.name)
