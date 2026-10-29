<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>JobCard-{{ $jobCard->id }}-{{ $jobCard->atm?->terminal_id ?? 'ATM' }}-{{ $jobCard->atm?->bank?->short_code ?? 'Bank' }}</title>
    <style>
        * { box-sizing: border-box; }
        body { margin: 0; padding: 20px; color: #111827; background: #fff; font: 10px Arial, sans-serif; }
        .sheet { width: 100%; max-width: 820px; margin: 0 auto; }
        .masthead { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding-bottom: 8px; border-bottom: 3px solid transparent; border-image: linear-gradient(90deg, #287ac0 0 55%, #ef4148 55% 100%) 1; }
        .logo { display: block; width: 68%; max-height: 74px; object-fit: contain; object-position: left center; }
        .title-row { min-width: 0; text-align: right; }
        .title-row h1 { margin: 0 0 3px; color: #174a73; font-size: 9px; font-weight: 800; letter-spacing: .13em; text-transform: uppercase; }
        .number { color: #111827; font-size: 17px; font-weight: 800; white-space: nowrap; }
        .number span { color: #b4232c; }
        .info { display: grid; grid-template-columns: 1.2fr .9fr; gap: 8px; margin: 10px 0 9px; }
        .info-group { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); align-content: start; gap: 6px 10px; min-width: 0; padding: 10px 11px; border-left: 2px solid #2e82cf; border-radius: 0 5px 5px 0; background: #f2f5f9; }
        .info-item { min-width: 0; overflow-wrap: anywhere; }
        .label { display: block; margin-bottom: 2px; color: #244b6b; font-size: 8px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
        .value { color: #111827; font-size: 9px; font-weight: 700; white-space: pre-wrap; overflow-wrap: anywhere; }
        h2 { display: flex; align-items: center; gap: 8px; margin: 9px 0 4px; color: #111827; font-size: 9px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; }
        h2::after { height: 1px; flex: 1; background: #9aa8b7; content: ""; }
        table { width: calc(100% - 20px); margin: 0 10px 5px; border: 1px solid #cbd7e5; border-radius: 6px; border-collapse: separate; border-spacing: 0; overflow: hidden; table-layout: fixed; }
        th, td { padding: 4px 9px; text-align: left; vertical-align: middle; }
        thead th { border-bottom: 1px solid #aeb9c5; color: #244b6b; background: #fff; font-size: 8px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; }
        th:last-child, td:last-child { width: 135px; text-align: right; }
        tbody tr:nth-child(odd) { background: #f3f6f9; }
        tbody td { border-bottom: 1px solid #d5dce4; color: #202b38; font-size: 8px; line-height: 1.3; }
        tbody tr:last-child td { border-bottom: 0; }
        td:last-child { color: #125c48; font-size: 8px; font-weight: 800; }
        .answer { display: inline-block; min-width: 74px; padding: 3px 8px; border-radius: 10px; background: #e8f4ef; color: #125c48; font-weight: 800; text-align: center; white-space: nowrap; }
        .answer-fail { background: #fceded; color: #982626; }
        .answer-na, .answer-nr { background: #eef2f6; color: #465363; }
        .wide { min-height: 31px; padding: 7px 9px; border-left: 2px solid #2e82cf; border-radius: 0 4px 4px 0; background: #f2f5f9; color: #17212d; font-weight: 600; line-height: 1.4; white-space: pre-wrap; overflow-wrap: anywhere; }
        .signatures { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-top: 8px; }
        .signature { min-width: 0; padding: 0 2px; text-align: left; }
        .signature .label { margin-bottom: 0; }
        .signature img { display: block; width: 100%; height: 34px; margin: 0 auto; object-fit: contain; }
        .signature-space { height: 34px; }
        .signature-name { min-height: 14px; padding-top: 4px; border-top: 1px solid #111827; color: #111827; font-size: 9px; font-weight: 700; }
        .actions { display: flex; justify-content: flex-end; max-width: 820px; margin: 0 auto 12px; }
        .actions button { padding: 9px 14px; border: 0; border-radius: 5px; background: #1b3a5c; color: #fff; font-weight: 700; cursor: pointer; }
        .masthead, .info, table, .wide, .signatures { break-inside: avoid; page-break-inside: avoid; }
        @page { size: A4 portrait; margin: 8mm; }
        @media print {
            body { padding: 0; font-size: 9px; }
            .sheet { max-width: none; }
            .actions { display: none; }
            * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
        @media (max-width: 600px) {
            body { padding: 12px; }
            .masthead { gap: 8px; }
            .logo { width: 62%; }
            .number { font-size: 14px; }
            .info { grid-template-columns: 1fr; }
            .info-group { gap: 6px; }
        }
    </style>
</head>
<body>
    <div class="actions">
        <button type="button" onclick="window.print()">Download / Print PDF</button>
    </div>
    @php
        $isPm = $jobCard->job_type === 'maintenance' || (!$jobCard->job_type && str_contains(strtolower($jobCard->type ?? ''), 'pm'));
        $checklistSections = [
            'canopyHood' => ['title' => 'TOP BOX / CANOPY', 'items' => [
                'Encrypting PIN pad and FDKs working',
                'Card reader: cleaned, transport clear, test transaction done',
                'Journal printer cleaned, print legible',
                'Receipt printer cleaned and working',
                'PC Core: opened and cleaned',
            ]],
            'cashDispenser' => ['title' => 'Cash Dispenser Modules', 'items' => [
                'All cassettes working (self-test run, notes learned)',
                'All pick modules / slots working',
                'D-wheel timing and status of all pick lines checked',
                'Carriage, Bill Aligner Module and SNT checked & cleaned',
                'Worn suction cups replaced',
                'Filter replaced',
                'Exit shutter cleaned',
            ]],
            'gbna' => ['title' => 'GBNA Module', 'items' => [
                'Pre-acceptor cleaned, status checked',
                'Cassettes accepting notes for configured denominations',
                'Escrow / reservoir and bill validator cleaned and checked',
                'Transport test: upper, lower and exit shutter',
            ]],
            'atmRoom' => ['title' => 'ATM Room', 'items' => [
                'Inverter / UPS installed and working',
                'Air conditioner installed and working',
            ]],
        ];
        $answers = ['ok' => 'Done', 'na' => 'N/A', 'nr' => 'No action needed', 'fail' => 'Not OK'];
        $date = $jobCard->completed_date ?? $jobCard->scheduled_date;
        $duration = (float) $jobCard->hours_spent;
        $signatureCards = [
            ['Engineer Name and Signature', $jobCard->engineer?->name, $jobCard->status !== 'draft' ? $jobCard->technician_signature : null],
        ];
        if (!$jobCard->phone_support) {
            $signatureCards[] = ['Custodian 1', $jobCard->custodian1_name, $jobCard->custodian1_signature];
            $signatureCards[] = ['Custodian 2', $jobCard->custodian2_name, $jobCard->custodian2_signature];
        }
    @endphp
    <main class="sheet">
        <header class="masthead">
            <img class="logo" src="{{ asset('logo.png') }}" alt="TechMasters">
            <div class="title-row">
                <h1>{{ $isPm ? 'ATM Preventive Maintenance Job Card' : 'ATM Repair Job Card' }}</h1>
                <div class="number"><span>No.</span>{{ $jobCard->id }}</div>
            </div>
        </header>

        <div class="info">
            <div class="info-group">
                @foreach ([
                    'Bank' => $jobCard->atm?->bank?->name,
                    'ATM Name' => $jobCard->atm?->terminal_id,
                    'Location / Site' => $jobCard->atm?->location,
                    'Model / Type' => $jobCard->atm?->model,
                    'Serial Number' => $jobCard->atm?->serial_number,
                ] as $label => $value)
                    <div class="info-item"><span class="label">{{ $label }}</span><span class="value">{{ $value ?: '—' }}</span></div>
                @endforeach
            </div>
            <div class="info-group">
                @foreach ([
                    'Date' => $date?->format('d-m-Y'),
                    'CE Start Time' => $jobCard->start_time ? substr((string) $jobCard->start_time, 0, 5) : null,
                    'CE End Time' => $jobCard->end_time ? substr((string) $jobCard->end_time, 0, 5) . ' (' . number_format($duration, 1) . ' hrs)' : null,
                ] as $label => $value)
                    <div class="info-item"><span class="label">{{ $label }}</span><span class="value">{{ $value ?: '—' }}</span></div>
                @endforeach
            </div>
        </div>

        @if ($isPm)
            @foreach ($checklistSections as $key => $section)
                @if (isset($jobCard->checklist[$key]))
                    <h2>{{ $section['title'] }}</h2>
                    <table>
                        <thead><tr><th>Checklist item</th><th>Status</th></tr></thead>
                        <tbody>
                            @foreach ($section['items'] as $index => $item)
                                @php($answer = $jobCard->checklist[$key][$index] ?? null)
                                <tr><td>@if ($item === 'PC Core: opened and cleaned')<strong>PC Core</strong>: opened and cleaned @else{{ $item }}@endif</td><td><span class="answer answer-{{ $answer ?? 'empty' }}">{{ $answers[$answer] ?? '—' }}</span></td></tr>
                            @endforeach
                        </tbody>
                    </table>
                @endif
            @endforeach
            <h2>Notes / Remarks</h2>
            <div class="wide">{{ $jobCard->notes ?: '—' }}</div>
        @else
            <h2>Fault Category</h2>
            <div class="wide">{{ $jobCard->fault_category ?: '—' }}</div>
            <h2>Work Performed / Resolution</h2>
            <div class="wide">{{ $jobCard->work_description ?: ($jobCard->resolution_notes ?: '—') }}</div>
            <h2>Spare Parts / Compound Used</h2>
            <div class="wide">{{ $jobCard->parts_used ?: '—' }}</div>
        @endif

        @if ($jobCard->phone_support)
            <h2>Resolution Method</h2>
            <div class="wide">Resolved via phone support — no custodian signature required</div>
        @endif
        <h2>{{ $isPm ? 'ATM Status After Visit' : 'Status After Repair' }}</h2>
        <div class="wide">{{ $jobCard->atm_status ?: '—' }}</div>
        <div class="signatures" style="grid-template-columns: repeat({{ count($signatureCards) }}, minmax(0, 1fr))">
            @foreach ($signatureCards as [$label, $name, $signature])
                <div class="signature">
                    @if ($signature)
                        <img src="{{ $signature }}" alt="{{ $label }}">
                    @else
                        <div class="signature-space"></div>
                    @endif
                    <div class="signature-name">{{ $name ?: '—' }}</div>
                    <span class="label">{{ $label }}</span>
                </div>
            @endforeach
        </div>
    </main>
    <script>
        window.addEventListener('load', () => window.setTimeout(() => window.print(), 250));
    </script>
</body>
</html>
