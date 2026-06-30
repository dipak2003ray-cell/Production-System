from typing import List, Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..models.process import ProcessMaster
from ..schemas.process_driver import ProcessDriverMetadataSchema, DriverPayloadSchema, DriverValidationResponse
from .driver_validation_service import DriverValidationService, DRIVER_METADATA

class ProcessDriverService:
    @staticmethod
    def list_supported_drivers() -> List[ProcessDriverMetadataSchema]:
        """Provides dynamic config list of overall system metadata."""
        results = []
        for drv, meta in DRIVER_METADATA.items():
            results.append(ProcessDriverMetadataSchema(
                driver_type=drv,
                sub_type_from_driver=meta["sub_type_from_driver"],
                thickness_from_driver=meta["thickness_from_driver"],
                fixed_sub_type=meta["fixed_sub_type"]
            ))
        return results

    @staticmethod
    def get_driver_metadata(driver_type: str) -> Optional[ProcessDriverMetadataSchema]:
        """Looks up meta specs for a single dynamic category."""
        meta = DriverValidationService.get_metadata(driver_type)
        if not meta:
            return None
        return ProcessDriverMetadataSchema(
            driver_type=driver_type.upper().strip(),
            sub_type_from_driver=meta["sub_type_from_driver"],
            thickness_from_driver=meta["thickness_from_driver"],
            fixed_sub_type=meta["fixed_sub_type"]
        )

    @staticmethod
    async def get_process_driver_config(db: AsyncSession, process_id: str) -> Optional[ProcessDriverMetadataSchema]:
        """Determines process driver properties associated with a registered Process master."""
        res = await db.execute(
            select(ProcessMaster).filter(ProcessMaster.id == process_id, ProcessMaster.is_deleted == False)
        )
        process = res.scalars().first()
        if not process or not process.driver_type:
            return None
        return ProcessDriverService.get_driver_metadata(process.driver_type)
