from rest_framework.permissions import BasePermission, SAFE_METHODS


class IsOwnerOrReadOnly(BasePermission):

    def has_permission(self, request, view):
        # precisa estar autenticado sempre
        return request.user and request.user.is_authenticated

    def has_object_permission(self, request, view, obj):
        # leitura liberada
        if request.method in SAFE_METHODS:
            return True

        # escrita só dono
        return getattr(obj, "created_by_id", None) == request.user.id
