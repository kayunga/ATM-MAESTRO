<?php

namespace App\Http\Controllers;

use App\Models\JobCard;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use ZipArchive;

class JobCardDownloadController extends Controller
{
    /**
     * Download a single attachment in its original format.
     * GET /job-cards/{jobCard}/files/{index}
     *
     * @param int $index  Zero-based index into the attachments array.
     */
    public function singleFile(Request $request, JobCard $jobCard, int $index = 0)
    {
        $jobCard->loadMissing('atm.bank');
        $attachments = $jobCard->attachments ?? [];

        if (empty($attachments) || !isset($attachments[$index])) {
            abort(404, 'Attachment not found.');
        }

        $file = $attachments[$index];
        $path = storage_path("app/public/{$file['path']}");

        if (!file_exists($path)) {
            abort(404, 'File not found on disk.');
        }

        // Build a descriptive filename: ATM-TERMINALID-TYPE-DATE.ext
        $ext      = pathinfo($file['name'], PATHINFO_EXTENSION);
        $atmCode  = str_replace([' ','/','\\'], '-', $jobCard->atm->terminal_id ?? 'ATM');
        $bank     = str_replace([' ','/','\\'], '-', $jobCard->atm->bank->short_code ?? '');
        $type     = str_replace([' ','/','\\'], '-', $jobCard->type ?? 'PM');
        $date     = now()->format('d-m-Y');
        $fileNum  = $index > 0 ? "-".($index+1) : "";
        $filename = "{$atmCode}-{$bank}-{$type}-{$date}{$fileNum}.{$ext}";

        return response()->download($path, $filename, [
            'Content-Type' => $file['type'] ?? 'application/octet-stream',
        ]);
    }

    /**
     * Bulk download — multiple job cards as one ZIP, organised by bank/ATM.
     * POST /job-cards/bulk-download
     */
    public function bulk(Request $request)
    {
        $request->validate([
            'ids'   => ['required', 'array'],
            'ids.*' => ['integer', 'exists:job_cards,id'],
        ]);

        $cards = JobCard::whereIn('id', $request->ids)
            ->with('atm.bank', 'engineer')
            ->get();

        $filename = 'jobcards-' . now()->format('Y-m-d') . '.zip';
        $tmpPath  = storage_path("app/tmp/{$filename}");

        if (!is_dir(storage_path('app/tmp'))) {
            mkdir(storage_path('app/tmp'), 0755, true);
        }

        $zip = new ZipArchive();

        if ($zip->open($tmpPath, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
            abort(500, 'Failed to create ZIP archive.');
        }

        $hasFiles = false;

        foreach ($cards as $card) {
            $attachments = $card->attachments ?? [];
            if (empty($attachments)) continue;

            // Folder: BankCode / TerminalID-TYPE /
            $type   = str_replace([' ','/','\\'], '-', $card->type ?? 'PM');
            $folder = "{$card->atm->bank->short_code}/{$card->atm->terminal_id}-{$type}";

            foreach ($attachments as $file) {
                $ext      = pathinfo($file['name'], PATHINFO_EXTENSION);
                $date     = $card->submitted_at?->format('d-m-Y') ?? now()->format('d-m-Y');
                $name     = "{$card->atm->terminal_id}-{$card->atm->bank->short_code}-{$type}-{$date}.{$ext}";
                $path = storage_path("app/public/{$file['path']}");
                if (file_exists($path)) {
                    $zip->addFile($path, "{$folder}/{$name}");
                    $hasFiles = true;
                }
            }
        }

        $zip->close();

        if (!$hasFiles) {
            unlink($tmpPath);
            return back()->with('error', 'None of the selected job cards have attachments.');
        }

        return response()->download($tmpPath, $filename)->deleteFileAfterSend(true);
    }
}
