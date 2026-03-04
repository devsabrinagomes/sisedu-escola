from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    ApplicationAbsentView,
    ApplicationAnswersView,
    BookletAddQuestionView,
    BookletPdfPreviewView,
    BookletKitPdfView,
    BookletItemDetailView,
    BookletItemsBulkView,
    BookletItemsView,
    BookletViewSet,
    SubjectViewSet,
    TopicViewSet,
    DescriptorViewSet,
    SkillViewSet,
    MockSigeClassStudentsView,
    MockSigeSchoolClassesView,
    MockSigeSchoolsView,
    OfferApplicationsSyncView,
    OfferKitPdfView,
    OfferReportExportCsvView,
    OfferReportExportExcelView,
    OfferReportExportPdfView,
    OfferReportItemsCsvView,
    OfferReportItemsPdfView,
    OfferReportStudentsCsvView,
    OfferReportStudentsPdfView,
    OfferReportSummaryView,
    preview_caderno_prova_publico_pdf,
    preview_cartao_resposta_pdf,
    preview_relatorio_publico_pdf,
    ReportPdfPreviewView,
    ReportsByClassView,
    ReportsOverviewView,
    OfferViewSet,
    ChatSendView,
    ChatConversationDetailView,
    QuestionViewSet,
)

router = DefaultRouter()
router.register(r"subjects", SubjectViewSet, basename="subject")
router.register(r"topics", TopicViewSet, basename="topic")
router.register(r"descriptors", DescriptorViewSet, basename="descriptor")
router.register(r"skills", SkillViewSet, basename="skill")
router.register(r"questions", QuestionViewSet, basename="question")
router.register(r"booklets", BookletViewSet, basename="booklet")
router.register(r"cadernos", BookletViewSet, basename="caderno")
router.register(r"offers", OfferViewSet, basename="offer")
router.register(r"ofertas", OfferViewSet, basename="oferta")

urlpatterns = [
    *router.urls,
    path("mock/sige/schools/", MockSigeSchoolsView.as_view(), name="mock-sige-schools"),
    path(
        "mock/sige/schools/<int:school_ref>/classes/",
        MockSigeSchoolClassesView.as_view(),
        name="mock-sige-school-classes",
    ),
    path(
        "mock/sige/classes/<int:class_ref>/students/",
        MockSigeClassStudentsView.as_view(),
        name="mock-sige-class-students",
    ),
    path(
        "offers/<int:offer_id>/applications/sync/",
        OfferApplicationsSyncView.as_view(),
        name="offer-applications-sync",
    ),
    path(
        "offers/<int:offer_id>/kit/<str:kind>/",
        OfferKitPdfView.as_view(),
        name="offer-kit-pdf",
    ),
    path(
        "booklets/<int:booklet_id>/kit/<str:kind>/",
        BookletKitPdfView.as_view(),
        name="booklet-kit-pdf",
    ),
    path(
        "cadernos/<int:booklet_id>/kit/<str:kind>/",
        BookletKitPdfView.as_view(),
        name="caderno-kit-pdf",
    ),
    path(
        "offers/<int:offer_id>/reports/summary/",
        OfferReportSummaryView.as_view(),
        name="offer-report-summary",
    ),
    path(
        "offers/<int:offer_id>/reports/export.csv",
        OfferReportExportCsvView.as_view(),
        name="offer-report-export-csv",
    ),
    path(
        "offers/<int:offer_id>/reports/export.pdf",
        OfferReportExportPdfView.as_view(),
        name="offer-report-export-pdf",
    ),
    path(
        "offers/<int:offer_id>/reports/export.xls",
        OfferReportExportExcelView.as_view(),
        name="offer-report-export-excel",
    ),
    path(
        "offers/<int:offer_id>/reports/students.csv",
        OfferReportStudentsCsvView.as_view(),
        name="offer-report-students-csv",
    ),
    path(
        "offers/<int:offer_id>/reports/students.pdf",
        OfferReportStudentsPdfView.as_view(),
        name="offer-report-students-pdf",
    ),
    path(
        "offers/<int:offer_id>/reports/items.csv",
        OfferReportItemsCsvView.as_view(),
        name="offer-report-items-csv",
    ),
    path(
        "offers/<int:offer_id>/reports/items.pdf",
        OfferReportItemsPdfView.as_view(),
        name="offer-report-items-pdf",
    ),
    path(
        "reports/overview/",
        ReportsOverviewView.as_view(),
        name="reports-overview",
    ),
    path(
        "pdf/preview/booklet/",
        preview_caderno_prova_publico_pdf,
        name="pdf-preview-booklet-public",
    ),
    path("pdf/preview/reports/", preview_relatorio_publico_pdf, name="pdf-preview-reports-public"),
    path("pdf/preview/booklet/<int:booklet_id>/", BookletPdfPreviewView.as_view(), name="pdf-preview-booklet"),
    path("pdf/preview/", preview_cartao_resposta_pdf, name="pdf-preview"),
    path("pdf/preview/reports/<int:offer_id>/", ReportPdfPreviewView.as_view(), name="pdf-preview-reports"),
    path(
        "reports/by-class/<int:offer_id>/",
        ReportsByClassView.as_view(),
        name="reports-by-class",
    ),
    path(
        "applications/<int:application_id>/answers/",
        ApplicationAnswersView.as_view(),
        name="application-answers",
    ),
    path(
        "applications/<int:application_id>/absent/",
        ApplicationAbsentView.as_view(),
        name="application-absent",
    ),
    path("cadernos/<int:id>/add-question/", BookletAddQuestionView.as_view(), name="caderno-add-question"),
    path("booklets/<int:id>/items/", BookletItemsView.as_view(), name="booklet-items"),
    path("booklets/<int:id>/items/bulk/", BookletItemsBulkView.as_view(), name="booklet-items-bulk"),
    path("booklets/<int:id>/items/<int:item_id>/", BookletItemDetailView.as_view(), name="booklet-item-detail"),
    path("chat/send/", ChatSendView.as_view(), name="chat-send"),
    path("chat/conversation/<int:id>/", ChatConversationDetailView.as_view(), name="chat-conversation-detail"),
]
