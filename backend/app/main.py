import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .core.config import settings
from .api import bootstrap, auth, users, customers, materials, processes, scrap, rates, process_drivers, boms, cost_sheets, cost_intelligence

app = FastAPI(
    title=settings.PROJECT_NAME,
    version="1.0.0",
    docs_url="/docs" if os.getenv("ENV") != "production" else None
)

# CORS Middleware config
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Route registration
app.include_router(bootstrap.router, prefix=settings.API_V1_STR)
app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(users.router, prefix=settings.API_V1_STR)
app.include_router(customers.router, prefix=settings.API_V1_STR)
app.include_router(materials.router, prefix=settings.API_V1_STR)
app.include_router(processes.router, prefix=settings.API_V1_STR)
app.include_router(scrap.router, prefix=settings.API_V1_STR)
app.include_router(rates.router, prefix=settings.API_V1_STR)
app.include_router(process_drivers.router, prefix=settings.API_V1_STR)
app.include_router(boms.router, prefix=settings.API_V1_STR)
app.include_router(cost_sheets.router, prefix=settings.API_V1_STR)
app.include_router(cost_intelligence.router, prefix=settings.API_V1_STR)

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": settings.PROJECT_NAME}
