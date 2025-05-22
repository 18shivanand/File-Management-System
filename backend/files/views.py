from django.shortcuts import render
from django.db import models
from rest_framework import viewsets, status, filters
from rest_framework.response import Response
from rest_framework.decorators import action
from django_filters.rest_framework import DjangoFilterBackend
from .models import File
from .serializers import FileSerializer
import hashlib

# Create your views here.

class FileViewSet(viewsets.ModelViewSet):
    queryset = File.objects.all()
    serializer_class = FileSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['original_filename']
    filterset_fields = {
        'file_type': ['exact', 'icontains'],  # <-- add 'icontains'
        'size': ['gte', 'lte'],
        'uploaded_at': ['date__gte', 'date__lte'],
    }
    ordering_fields = ['uploaded_at', 'size', 'original_filename']
    pagination_class = None  # <-- Remove pagination

    def create(self, request, *args, **kwargs):
        file_obj = request.FILES.get('file')
        if not file_obj:
            return Response({'error': 'No file provided'}, status=status.HTTP_400_BAD_REQUEST)

        # Calculate hash
        hasher = hashlib.sha256()
        for chunk in file_obj.chunks():
            hasher.update(chunk)
        file_hash = hasher.hexdigest()
        file_obj.seek(0)

        # Check for duplicate
        try:
            existing_file = File.objects.get(hash=file_hash)
            return Response(
                {
                    'duplicate': True,
                    'message': 'File is already uploaded.'
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        except File.DoesNotExist:
            # Not a duplicate, proceed as normal
            # Get file type from uploaded file
            file_type = file_obj.content_type or ''
            data = {
                'file': file_obj,
                'original_filename': file_obj.name,
                'file_type': file_type,
                'size': file_obj.size,
                'hash': file_hash
            }
            serializer = self.get_serializer(data=data)
            serializer.is_valid(raise_exception=True)
            self.perform_create(serializer)
            headers = self.get_success_headers(serializer.data)
            return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    @action(detail=False, methods=['get'])
    def storage_savings(self, request):
        total_uploaded = File.objects.all().aggregate(total=models.Sum('size'))['total'] or 0
        unique_hashes = File.objects.values('hash').distinct()
        unique_files = File.objects.filter(hash__in=[u['hash'] for u in unique_hashes])
        actual_storage = unique_files.aggregate(total=models.Sum('size'))['total'] or 0
        savings = total_uploaded - actual_storage
        return Response({
            'total_uploaded_bytes': total_uploaded,
            'actual_storage_bytes': actual_storage,
            'savings_bytes': savings
        })
