from django.shortcuts import get_object_or_404
from rest_framework.exceptions import PermissionDenied

from .models import Application, Booklet, Offer


class OwnerAccessMixin:
    def ensure_owner(self, request, instance, message):
        if request.user.is_superuser:
            return
        if getattr(instance, "created_by", None) != request.user.id:
            raise PermissionDenied(message)

    def soft_delete(self, instance):
        instance.deleted = True
        instance.save(update_fields=["deleted"])

    def get_owned_offer(self, request, offer_id, *, message):
        offer = get_object_or_404(Offer.objects.select_related("booklet"), id=offer_id, deleted=False)
        self.ensure_owner(request, offer, message)
        return offer

    def get_owned_booklet(self, request, booklet_id, *, message):
        booklet = get_object_or_404(Booklet, id=booklet_id, deleted=False)
        self.ensure_owner(request, booklet, message)
        return booklet

    def get_owned_application(self, request, application_id, *, message):
        application = get_object_or_404(
            Application.objects.select_related("offer", "offer__booklet"),
            id=application_id,
            offer__deleted=False,
        )
        if not request.user.is_superuser and application.offer.created_by != request.user.id:
            raise PermissionDenied(message)
        return application
