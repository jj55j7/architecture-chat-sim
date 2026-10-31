import asyncio
import uuid
import random
from typing import Dict, List, Any


from fastapi import FastAPI, HTTPException
from pydantic import BaseModel




app = FastAPI(
    title="Mock Network Simulation Service",
    description="Mock external service for the intern web-development assignment."
)




# -------------------------------------------------------------------
# Data models
# -------------------------------------------------------------------


class Node(BaseModel):
    id: str
    type: str | None = None




class SimulationRequest(BaseModel):
    nodes: List[Node]




class SimulationStatus(BaseModel):
    simulation_id: str
    status: str
    edges: List[Dict[str, Any]] | None = None




# -------------------------------------------------------------------
# In-memory simulation storage
# -------------------------------------------------------------------


simulations: Dict[str, Dict[str, Any]] = {}




# -------------------------------------------------------------------
# Simulation logic
# -------------------------------------------------------------------


async def run_simulation(simulation_id: str, nodes: List[Node]):
    """
    Pretend to perform a network simulation.


    The delay is intentional. It allows the frontend developer to
    demonstrate asynchronous API integration.
    """


    simulations[simulation_id]["status"] = "running"


    # Pretend that the simulation takes some time.
    await asyncio.sleep(15)


    if len(nodes) < 2:
        simulations[simulation_id]["status"] = "completed"
        simulations[simulation_id]["edges"] = []
        return


    # ---------------------------------------------------------------
    # Create a simple simulated path through the supplied nodes.
    #
    # This is intentionally deterministic enough to be useful for
    # the assignment, but has a little randomness so that the
    # frontend doesn't simply rely on hard-coded results.
    # ---------------------------------------------------------------


    shuffled_nodes = nodes.copy()


    # Keep the first node as the source and last node as destination,
    # but randomize the intermediate nodes.
    if len(shuffled_nodes) > 2:
        middle = shuffled_nodes[1:-1]
        random.shuffle(middle)
        shuffled_nodes = [
            shuffled_nodes[0],
            *middle,
            shuffled_nodes[-1]
        ]


    edges = []


    for i in range(len(shuffled_nodes) - 1):
        source = shuffled_nodes[i]
        target = shuffled_nodes[i + 1]


        edges.append({
            "source": source.id,
            "target": target.id,
            "latency_ms": random.randint(5, 50),
            "packets": random.randint(10, 100),
            "status": "success"
        })


    simulations[simulation_id]["status"] = "completed"
    simulations[simulation_id]["edges"] = edges




# -------------------------------------------------------------------
# API endpoints
# -------------------------------------------------------------------


@app.post("/simulate", response_model=SimulationStatus, status_code=202)
async def create_simulation(request: SimulationRequest):
    """
    Start a simulation.


    The simulation runs asynchronously. The caller receives a
    simulation ID and must poll /simulate/{simulation_id}.
    """


    if not request.nodes:
        raise HTTPException(
            status_code=400,
            detail="At least one node is required."
        )


    simulation_id = str(uuid.uuid4())


    simulations[simulation_id] = {
        "status": "queued",
        "nodes": [node.model_dump() for node in request.nodes],
        "edges": None
    }


    # Start simulation in the background.
    asyncio.create_task(
        run_simulation(simulation_id, request.nodes)
    )


    return SimulationStatus(
        simulation_id=simulation_id,
        status="queued"
    )




@app.get(
    "/simulate/{simulation_id}",
    response_model=SimulationStatus
)
async def get_simulation(simulation_id: str):
    """
    Get the current state of a simulation.
    """


    if simulation_id not in simulations:
        raise HTTPException(
            status_code=404,
            detail="Simulation not found."
        )


    simulation = simulations[simulation_id]


    return SimulationStatus(
        simulation_id=simulation_id,
        status=simulation["status"],
        edges=simulation["edges"]
    )




@app.get("/health")
async def health_check():
    return {
        "status": "ok"
    }
