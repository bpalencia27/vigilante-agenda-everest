from contextlib import asynccontextmanager
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn

from config import settings
from athenea_service import AtheneaService, PatientNotFoundError, AtheneaServiceError

athenea_service = AtheneaService()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle manager for FastAPI application to initialize and cleanup resources."""
    await athenea_service.start()
    yield
    await athenea_service.stop()


app = FastAPI(
    title="Athenea API Bridge",
    description="Microservicio local FastAPI usando Playwright en modo headless para el portal de Athenea",
    version="1.0.0",
    lifespan=lifespan
)

# Configurar CORS middleware para permitir peticiones GET desde Tampermonkey y cualquier origen
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["GET", "OPTIONS"],
    allow_headers=["*"],
)


@app.get("/ping")
async def ping():
    """Endpoint de estado para verificacion de disponibilidad (Health check)."""
    return JSONResponse(status_code=200, content={"status": "ok"})


@app.get("/api/buscar_laboratorios")
async def buscar_laboratorios(
    documento: str = Query(..., description="Numero de documento del paciente")
):
    """
    Busca laboratorios para el documento especificado y retorna idSolicitud.

    :param documento: Numero de identificacion del paciente.
    :return: JSON {"idSolicitud": int} en exito (200 OK) o {"error": str} en fallo (400, 404, 500).
    """
    doc_clean = str(documento).strip() if documento else ""
    if not doc_clean:
        return JSONResponse(
            status_code=400,
            content={"error": "El parametro 'documento' es requerido y no puede estar vacio."}
        )

    try:
        id_solicitud = await athenea_service.get_id_solicitud(doc_clean)
        return JSONResponse(
            status_code=200,
            content={"idSolicitud": id_solicitud}
        )
    except PatientNotFoundError as e:
        return JSONResponse(
            status_code=404,
            content={"error": str(e)}
        )
    except ValueError as e:
        return JSONResponse(
            status_code=404,
            content={"error": str(e)}
        )
    except TimeoutError as e:
        return JSONResponse(
            status_code=500,
            content={"error": str(e)}
        )
    except AtheneaServiceError as e:
        return JSONResponse(
            status_code=500,
            content={"error": str(e)}
        )
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"error": f"Error interno inesperado: {str(e)}"}
        )


if __name__ == "__main__":
    uvicorn.run(app, host=settings.HOST, port=settings.PORT)
