<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // ── Banks (12 Zambian banks) ───────────────────────────────────────────
        $banks = [
            ['name' => 'Zanaco',                       'short_code' => 'ZNC', 'contact_person' => 'Mutale Nkonde',  'contact_phone' => '+260 211 228 888', 'contact_email' => 'operations@zanaco.zm',      'headquarters' => 'Cairo Road, Lusaka',             'notes' => 'Largest bank fleet'],
            ['name' => 'Stanbic Bank Zambia',           'short_code' => 'SBZ', 'contact_person' => 'Chanda Mwewa',  'contact_phone' => '+260 211 370 600', 'contact_email' => 'support@stanbic.zm',        'headquarters' => 'Addis Ababa Roundabout, Lusaka', 'notes' => null],
            ['name' => 'FNB Zambia',                    'short_code' => 'FNB', 'contact_person' => 'Bwalya Tembo',  'contact_phone' => '+260 211 369 000', 'contact_email' => 'fnbzambia@fnb.zm',          'headquarters' => 'Farmers House, Lusaka',          'notes' => null],
            ['name' => 'Absa Bank Zambia',              'short_code' => 'ABS', 'contact_person' => 'Tendai Phiri',  'contact_phone' => '+260 211 370 700', 'contact_email' => 'absazambia@absa.africa',    'headquarters' => 'Kafue Road, Lusaka',             'notes' => null],
            ['name' => 'Standard Chartered Zambia',     'short_code' => 'SCZ', 'contact_person' => 'Monde Musonda', 'contact_phone' => '+260 211 224 242', 'contact_email' => 'scbzambia@sc.com',          'headquarters' => 'Cairo Road, Lusaka',             'notes' => null],
            ['name' => 'Access Bank Zambia',            'short_code' => 'ACB', 'contact_person' => 'Kasonde Lombe', 'contact_phone' => '+260 211 238 560', 'contact_email' => 'info@accessbankzambia.com', 'headquarters' => 'Addis Ababa Drive, Lusaka',      'notes' => null],
            ['name' => 'Atlas Mara Zambia',             'short_code' => 'ATL', 'contact_person' => 'Nsofwa Daka',   'contact_phone' => '+260 211 257 000', 'contact_email' => 'info@atlasmara.zm',         'headquarters' => 'Lusaka',                         'notes' => null],
            ['name' => 'Indo Zambia Bank',              'short_code' => 'IZB', 'contact_person' => 'Priya Sharma',  'contact_phone' => '+260 211 228 431', 'contact_email' => 'info@izb.co.zm',            'headquarters' => 'Cairo Road, Lusaka',             'notes' => null],
            ['name' => 'United Bank for Africa Zambia', 'short_code' => 'UBA', 'contact_person' => 'Emeka Okafor',  'contact_phone' => '+260 211 238 440', 'contact_email' => 'ubazambia@ubagroup.com',    'headquarters' => 'Lusaka',                         'notes' => null],
            ['name' => 'Citibank Zambia',               'short_code' => 'CTB', 'contact_person' => 'James Phiri',   'contact_phone' => '+260 211 229 026', 'contact_email' => 'citibank.zambia@citi.com',  'headquarters' => 'Haile Selassie Ave, Lusaka',     'notes' => null],
            ['name' => 'Bank of China Zambia',          'short_code' => 'BOC', 'contact_person' => 'Li Wei',        'contact_phone' => '+260 211 252 000', 'contact_email' => 'boczambia@bankofchina.com', 'headquarters' => 'Lusaka',                         'notes' => null],
            ['name' => 'Madison Finance',               'short_code' => 'MAD', 'contact_person' => 'Grace Mwanza',  'contact_phone' => '+260 211 252 890', 'contact_email' => 'info@madisonfinance.zm',   'headquarters' => 'Lusaka',                         'notes' => null],
        ];

        DB::table('banks')->insert(array_map(fn ($b) => array_merge($b, ['created_at' => now(), 'updated_at' => now()]), $banks));
        $bankIds = DB::table('banks')->orderBy('id')->pluck('id', 'short_code');

        // ── 15 Engineers ──────────────────────────────────────────────────────
        $engineers = [
            ['name' => 'Tendai Mwale',   'phone' => '+260 97 111 2233', 'email' => 't.mwale@ncrservice.zm',   'region' => 'Lusaka'],
            ['name' => 'Bwalya Mutale',  'phone' => '+260 96 234 5678', 'email' => 'b.mutale@ncrservice.zm',  'region' => 'Copperbelt'],
            ['name' => 'Chanda Phiri',   'phone' => '+260 95 345 6789', 'email' => 'c.phiri@ncrservice.zm',   'region' => 'Southern'],
            ['name' => 'Mulenga Banda',  'phone' => '+260 97 456 7890', 'email' => 'm.banda@ncrservice.zm',   'region' => 'Lusaka'],
            ['name' => 'Kunda Tembo',    'phone' => '+260 96 567 8901', 'email' => 'k.tembo@ncrservice.zm',   'region' => 'Eastern'],
            ['name' => 'Namwaka Lungu',  'phone' => '+260 95 678 9012', 'email' => 'n.lungu@ncrservice.zm',   'region' => 'Northern'],
            ['name' => 'Pemba Mwanza',   'phone' => '+260 97 789 0123', 'email' => 'p.mwanza@ncrservice.zm',  'region' => 'Northwestern'],
            ['name' => 'Zulu Kabwe',     'phone' => '+260 96 890 1234', 'email' => 'z.kabwe@ncrservice.zm',   'region' => 'Central'],
            ['name' => 'Mwila Kapasa',   'phone' => '+260 95 901 2345', 'email' => 'm.kapasa@ncrservice.zm',  'region' => 'Copperbelt'],
            ['name' => 'Lombe Sichone',  'phone' => '+260 97 012 3456', 'email' => 'l.sichone@ncrservice.zm', 'region' => 'Lusaka'],
            ['name' => 'Daliso Nkonde',  'phone' => '+260 96 123 4567', 'email' => 'd.nkonde@ncrservice.zm',  'region' => 'Southern'],
            ['name' => 'Mwansa Chipimo', 'phone' => '+260 95 234 5678', 'email' => 'm.chipimo@ncrservice.zm', 'region' => 'Lusaka'],
            ['name' => 'Esther Mbewe',   'phone' => '+260 97 345 6789', 'email' => 'e.mbewe@ncrservice.zm',   'region' => 'Eastern'],
            ['name' => 'Patrick Zulu',   'phone' => '+260 96 456 7890', 'email' => 'p.zulu@ncrservice.zm',    'region' => 'Western'],
            ['name' => 'Ruth Mubanga',   'phone' => '+260 95 567 8901', 'email' => 'r.mubanga@ncrservice.zm', 'region' => 'Luapula'],
        ];

        DB::table('engineers')->insert(array_map(fn ($e) => array_merge($e, ['created_at' => now(), 'updated_at' => now()]), $engineers));
        $engIds = DB::table('engineers')->orderBy('id')->pluck('id')->toArray();

        // ── Location pools per bank ───────────────────────────────────────────
        $locations = [
            'ZNC' => [['Cairo Road Branch','Cairo Road, Lusaka CBD'],['Manda Hill Mall','Manda Hill Shopping Centre, Lusaka'],['Levy Junction','Levy Business Park, Lusaka'],['East Park Mall','Great East Road, Lusaka'],['Woodlands','Woodlands, Lusaka'],['Chilenje','Chilenje, Lusaka'],['Matero','Matero, Lusaka'],['Kalingalinga','Kalingalinga, Lusaka'],['Kitwe Central','Independence Ave, Kitwe'],['Ndola Main','Broadway, Ndola'],['Livingstone Main','Mosi-oa-Tunya Road, Livingstone'],['Chipata','Chipata Town Centre'],['Kabwe Main','Freedom Way, Kabwe'],['Solwezi','Solwezi Town'],['Kasama','Kasama Town'],['Mongu','Mongu Town'],['Chingola','Chingola Town'],['Luanshya','Luanshya Town'],['Kalulushi','Kalulushi Town'],['Mufulira','Mufulira Town'],['Choma','Choma Town'],['Mazabuka','Mazabuka Town'],['Kafue','Kafue Town'],['Siavonga','Siavonga Town'],['Petauke','Petauke Town']],
            'SBZ' => [['Stanbic Cairo Road','Cairo Road, Lusaka'],['Stanbic Manda Hill','Manda Hill, Lusaka'],['Stanbic Kitwe','Independence Ave, Kitwe'],['Stanbic Ndola','Broadway, Ndola'],['Stanbic Livingstone','Mosi-oa-Tunya Rd, Livingstone'],['Stanbic Kabwe','Freedom Way, Kabwe'],['Stanbic Chingola','Chingola Town'],['Stanbic Chipata','Chipata CBD'],['Stanbic Solwezi','Solwezi Town Centre'],['Stanbic Lusaka West','Lusaka West'],['Stanbic Arcades','Arcades Shopping Centre, Lusaka'],['Stanbic Woodlands','Woodlands Shopping Centre, Lusaka'],['Stanbic Kamwala','Kamwala, Lusaka'],['Stanbic Mazabuka','Mazabuka'],['Stanbic Monze','Monze Town'],['Stanbic Kasama','Kasama'],['Stanbic Mansa','Mansa, Luapula'],['Stanbic Mufulira','Mufulira'],['Stanbic Luanshya','Luanshya'],['Stanbic Airport Road','Airport Road, Lusaka']],
            'FNB' => [['FNB Livingstone Airport','Harry Mwanga Nkumbula Airport'],['FNB Cairo Road','Cairo Road, Lusaka'],['FNB Levy Park','Levy Business Park, Lusaka'],['FNB Kitwe','Kitwe Town Centre'],['FNB Ndola','Ndola City Centre'],['FNB Kabwe','Kabwe Town Centre'],['FNB Chipata','Chipata'],['FNB Solwezi','Solwezi Town'],['FNB Mongu','Mongu'],['FNB Kasama','Kasama'],['FNB Manda Hill','Manda Hill, Lusaka'],['FNB Arcades','Arcades Shopping Centre, Lusaka'],['FNB Longacres','Longacres, Lusaka'],['FNB Lusaka South','Lusaka South'],['FNB Chingola','Chingola'],['FNB Mufulira','Mufulira'],['FNB Choma','Choma'],['FNB Mazabuka','Mazabuka']],
            'ABS' => [['Absa Arcades','Great East Road, Lusaka'],['Absa Cairo Road','Cairo Road, Lusaka'],['Absa Manda Hill','Manda Hill, Lusaka'],['Absa Kitwe','Kitwe Town Centre'],['Absa Ndola','Ndola City Centre'],['Absa Livingstone','Livingstone Town Centre'],['Absa Kabwe','Kabwe Town Centre'],['Absa Chipata','Chipata'],['Absa Solwezi','Solwezi Town'],['Absa Chingola','Chingola'],['Absa Mufulira','Mufulira'],['Absa Luanshya','Luanshya'],['Absa Woodlands','Woodlands, Lusaka'],['Absa Chilenje','Chilenje, Lusaka'],['Absa Longacres','Longacres, Lusaka']],
            'SCZ' => [['StanChart Cairo Road','Cairo Road, Lusaka'],['StanChart Manda Hill','Manda Hill, Lusaka'],['StanChart Kitwe','Kitwe CBD'],['StanChart Ndola','Ndola CBD'],['StanChart Livingstone','Livingstone CBD'],['StanChart Woodlands','Woodlands, Lusaka'],['StanChart Longacres','Longacres, Lusaka'],['StanChart Chingola','Chingola'],['StanChart Kabwe','Kabwe']],
            'ACB' => [['Access Lusaka Main','Addis Ababa Drive, Lusaka'],['Access Kitwe','Kitwe CBD'],['Access Ndola','Ndola CBD'],['Access Manda Hill','Manda Hill, Lusaka'],['Access Chingola','Chingola'],['Access Livingstone','Livingstone CBD'],['Access Kabwe','Kabwe']],
            'ATL' => [['Atlas Mara Lusaka','Lusaka CBD'],['Atlas Mara Kitwe','Kitwe CBD'],['Atlas Mara Ndola','Ndola CBD'],['Atlas Mara Livingstone','Livingstone CBD'],['Atlas Mara Chipata','Chipata'],['Atlas Mara Solwezi','Solwezi']],
            'IZB' => [['IZB Cairo Road','Cairo Road, Lusaka'],['IZB Kitwe','Kitwe CBD'],['IZB Ndola','Ndola CBD'],['IZB Livingstone','Livingstone CBD'],['IZB Kabwe','Kabwe']],
            'UBA' => [['UBA Lusaka','Lusaka CBD'],['UBA Kitwe','Kitwe CBD'],['UBA Ndola','Ndola CBD'],['UBA Livingstone','Livingstone CBD']],
            'CTB' => [['Citi Lusaka Main','Haile Selassie Ave, Lusaka'],['Citi Kitwe','Kitwe CBD'],['Citi Ndola','Ndola CBD']],
            'BOC' => [['Bank of China Lusaka','Lusaka CBD'],['Bank of China Kitwe','Kitwe CBD'],['Bank of China Ndola','Ndola CBD']],
            'MAD' => [['Madison Lusaka','Lusaka CBD'],['Madison Kitwe','Kitwe CBD'],['Madison Ndola','Ndola CBD'],['Madison Livingstone','Livingstone CBD'],['Madison Kabwe','Kabwe']],
        ];

        $models   = ['NCR 6622','NCR 6626','NCR 6627','NCR 6634','NCR 6638','NCR 6684','NCR SelfServ 80','NCR SelfServ 84','NCR SelfServ 87'];
        $statuses = ['Active','Active','Active','Active','Active','Active','Offline','Offline','Under Maintenance','Decommissioned'];

        // ATMs per bank (totals ~300)
        $bankWeights = ['ZNC'=>55,'SBZ'=>45,'FNB'=>38,'ABS'=>32,'SCZ'=>25,'ACB'=>22,'ATL'=>18,'IZB'=>16,'UBA'=>14,'CTB'=>12,'BOC'=>10,'MAD'=>13];

        // Insert originals first
        $originals = [
            ['terminal_id'=>'ATM-ZNC-001','serial_number'=>'NCR684001ZM', 'model'=>'NCR 6684',       'location'=>'Cairo Road Branch',     'address'=>'Cairo Road, Lusaka CBD',                    'bank_id'=>$bankIds['ZNC'],'engineer_id'=>$engIds[0],'status'=>'Active',          'install_date'=>'2021-03-15','notes'=>'High traffic site'],
            ['terminal_id'=>'ATM-ZNC-002','serial_number'=>'NCR627002ZM', 'model'=>'NCR 6627',       'location'=>'Manda Hill Mall',        'address'=>'Manda Hill Shopping Centre, Lusaka',         'bank_id'=>$bankIds['ZNC'],'engineer_id'=>$engIds[0],'status'=>'Active',          'install_date'=>'2020-08-10','notes'=>null],
            ['terminal_id'=>'ATM-SBZ-001','serial_number'=>'NCR634003ZM', 'model'=>'NCR 6634',       'location'=>'Kitwe Main Branch',      'address'=>'Independence Ave, Kitwe',                    'bank_id'=>$bankIds['SBZ'],'engineer_id'=>$engIds[1],'status'=>'Under Maintenance','install_date'=>'2019-11-20','notes'=>'Card reader issue'],
            ['terminal_id'=>'ATM-FNB-001','serial_number'=>'NCRSS84004ZM','model'=>'NCR SelfServ 84','location'=>'Livingstone Airport',    'address'=>'Harry Mwanga Nkumbula Airport, Livingstone',  'bank_id'=>$bankIds['FNB'],'engineer_id'=>$engIds[2],'status'=>'Active',          'install_date'=>'2022-01-05','notes'=>'Tourist area'],
            ['terminal_id'=>'ATM-ABS-001','serial_number'=>'NCR622005ZM', 'model'=>'NCR 6622',       'location'=>'Arcades Shopping Centre','address'=>'Great East Road, Lusaka',                    'bank_id'=>$bankIds['ABS'],'engineer_id'=>$engIds[3],'status'=>'Offline',         'install_date'=>'2018-06-12','notes'=>'Power issue'],
        ];
        DB::table('atms')->insert(array_map(fn ($a) => array_merge($a, ['created_at'=>now(),'updated_at'=>now()]), $originals));

        $counters = ['ZNC'=>3,'SBZ'=>2,'FNB'=>2,'ABS'=>2,'SCZ'=>1,'ACB'=>1,'ATL'=>1,'IZB'=>1,'UBA'=>1,'CTB'=>1,'BOC'=>1,'MAD'=>1];
        $atms = [];
        $idx  = 0;
        $installYears = range(2016, 2023);

        foreach ($bankWeights as $code => $count) {
            $locs = $locations[$code];
            for ($i = 0; $i < $count; $i++) {
                $counter = str_pad($counters[$code]++, 3, '0', STR_PAD_LEFT);
                [$loc, $addr] = $locs[$i % count($locs)];
                $yr  = $installYears[$idx % count($installYears)];
                $mon = str_pad(($idx % 12) + 1, 2, '0', STR_PAD_LEFT);
                $day = str_pad(($idx % 28) + 1, 2, '0', STR_PAD_LEFT);
                $atms[] = [
                    'terminal_id'   => "ATM-{$code}-{$counter}",
                    'serial_number' => strtoupper($code) . (10000 + $idx),
                    'model'         => $models[$idx % count($models)],
                    'location'      => $loc,
                    'address'       => $addr,
                    'bank_id'       => $bankIds[$code],
                    'engineer_id'   => $engIds[$idx % 15],
                    'status'        => $statuses[$idx % count($statuses)],
                    'install_date'  => "{$yr}-{$mon}-{$day}",
                    'notes'         => null,
                    'created_at'    => now(),
                    'updated_at'    => now(),
                ];
                $idx++;
            }
        }

        foreach (array_chunk($atms, 100) as $chunk) {
            DB::table('atms')->insert($chunk);
        }

        // ── Maintenance (~2-3 per ATM) ────────────────────────────────────────
        $allAtms     = DB::table('atms')->pluck('id', 'terminal_id');
        $mTypes      = ['Quarterly PM','Emergency','Part Replacement','Software Update','Cash Jam','Card Reader Service'];
        $mStatuses   = ['Completed','Completed','Completed','In Progress','Scheduled','Cancelled'];
        $mNotes      = ['All checks passed.','Routine PM completed.','Card reader cleaned.','Replaced cash cassette.','Software updated.','Awaiting spare part.','Power supply replaced.','Cash jam cleared.','Keypad serviced.',null,null,null];
        $maintenance = [];

        foreach ($allAtms as $termId => $atmId) {
            $seed  = abs(crc32($termId));
            $count = ($seed % 3) + 1;
            for ($r = 0; $r < $count; $r++) {
                $s2      = abs(crc32($termId . $r));
                $qtr     = ($r % 4) + 1;
                $yr      = $r < 2 ? 2024 : 2023;
                $mon     = str_pad($qtr * 3 - 1, 2, '0', STR_PAD_LEFT);
                $day     = str_pad(($s2 % 20) + 1, 2, '0', STR_PAD_LEFT);
                $mStat   = $mStatuses[$s2 % count($mStatuses)];
                $maintenance[] = [
                    'atm_id'         => $atmId,
                    'engineer_id'    => $engIds[$s2 % 15],
                    'type'           => $mTypes[$s2 % count($mTypes)],
                    'status'         => $mStat,
                    'scheduled_date' => "{$yr}-{$mon}-{$day}",
                    'completed_date' => $mStat === 'Completed' ? "{$yr}-{$mon}-{$day}" : null,
                    'quarter'        => $qtr,
                    'year'           => $yr,
                    'notes'          => $mNotes[$s2 % count($mNotes)],
                    'created_at'     => now(),
                    'updated_at'     => now(),
                ];
            }
        }

        foreach (array_chunk($maintenance, 100) as $chunk) {
            DB::table('maintenance_records')->insert($chunk);
        }

        $this->command->info(sprintf(
            '✅ Seeded: %d banks, %d engineers, %d ATMs, %d maintenance records.',
            DB::table('banks')->count(),
            DB::table('engineers')->count(),
            DB::table('atms')->count(),
            DB::table('maintenance_records')->count()
        ));
    }
}
