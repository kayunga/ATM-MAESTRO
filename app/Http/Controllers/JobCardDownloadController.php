<?php

namespace App\Http\Controllers;

use App\Models\JobCard;
use Illuminate\Http\Request;

class JobCardDownloadController extends Controller
{
    /**
     * Open a print-ready copy of the saved job card.
     * GET /job-cards/{jobCard}/print
     */
    public function printCard(Request $request, JobCard $jobCard)
    {
        $user = $request->user();
        $isAssignedEngineer = $jobCard->engineer()
            ->where('user_id', $user->id)
            ->exists();

        abort_unless($user->is_admin || $isAssignedEngineer, 403);

        $jobCard->load(['atm.bank', 'engineer', 'reviewer']);

        return view('job-cards.print', compact('jobCard'));
    }

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

}
