from starlette.middleware.base import BaseHTTPMiddleware
from fastapi import Request


class BusinessBranchMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        business_id = request.headers.get('x-omnibiz-business-id')
        branch_id = request.headers.get('x-omnibiz-branch-id')

        try:
            request.state.business_id = int(business_id) if business_id else None
        except ValueError:
            request.state.business_id = None

        try:
            request.state.branch_id = int(branch_id) if branch_id else None
        except ValueError:
            request.state.branch_id = None

        return await call_next(request)
