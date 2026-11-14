# Arsip Skrip LMS Lama

Folder ini berisi skrip SQL lama dari fase LMS / Assignment Hub yang sudah tidak digunakan pada aplikasi Portal Kampus Peer-to-Peer saat ini:

- `academic_and_lms.sql`
- `drop_assignment_tables.sql`
- `transform_materials_to_peer_library.sql`
- `academic_seed.sql`

File di folder ini disimpan hanya untuk referensi historis dan **tidak boleh** dijalankan pada instalasi baru.
Jika database lama Anda masih menyimpan tabel atau kolom legacy dari skrip ini, tinjau `database/migrations/003_cleanup_legacy_lms_up.sql` secara manual setelah melakukan backup `mysqldump`.
