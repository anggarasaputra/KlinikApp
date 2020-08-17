/*global _ m makeReport withThis moment db makePdf hari look rupiah tarifIGD lookReferences ors lookUser lookGoods selects ands beds tarifInap*/

var reports = {
  cashier: () => makeReport(
    'Penerimaan Kasir (Poli & IGD)',
    e => withThis(
      {
        start: +moment(e.target[0].value),
        end: +moment(e.target[1].value),
        selection: e.target[2].value
      },
      obj => [
        e.preventDefault(),
        db.patients.toArray(array => makePdf.report(
          'Penerimaan Kasir (Poli & IGD)',
          [['Tanggal', 'No. MR', 'Nama Pasien', 'Layanan', 'Tarif', 'Obat', 'Tindakan', 'Jumlah', 'Kasir']]
          .concat(
            _.flattenDeep(array.map(
              i => ([]).concat(i.rawatJalan || [],i.emergency || [])
              .map(j => ands([
                j.cara_bayar === +obj.selection,
                (j.tanggal || j.tanggal_masuk) > obj.start,
                (j.tanggal || j.tanggal_masuk) < obj.end,
                +obj.selection === 1 ? j.bayar_konsultasi : true,
                {pasien: i, rawat: j}
              ])).filter(Boolean)
            ).filter(l => l.length))
            .sort((a, b) => a.rawat.tanggal - b.rawat.tanggal)
            .map(i => [
              hari(i.rawat.tanggal),
              String(i.pasien.identitas.no_mr),
              i.pasien.identitas.nama_lengkap,
              ors([ // pilihan layanan
                i.rawat.klinik && look('klinik', i.rawat.klinik),
                i.rawat.bed && 'Rawat Inap', 'IGD'
              ]),
              rupiah(ors([ // tarif layanan tersebut
                i.rawat.klinik &&
                +look('tarif_klinik', i.rawat.klinik)*1000,
                i.rawat.bed &&
                tarifInap(
                  i.rawat.tanggal_masuk, i.rawat.keluar,
                  beds[_.get(i.rawat.bed, 'kelas')].tarif
                ),
                tarifIGD
              ])),
              rupiah(_.get(i, 'rawat.soapDokter.obat') ? _.sum(
                i.rawat.soapDokter.obat.map(j => j.harga)
              ) : 0),
              rupiah(_.get(i, 'rawat.soapDokter.tindakan') ? _.sum(
                i.rawat.soapDokter.tindakan.map(
                  j => +lookReferences(j.idtindakan).harga
                )
              ) : 0),
              rupiah(_.sum([
                !i.rawat.klinik ? tarifIGD :
                +look('tarif_klinik', i.rawat.klinik)*1000,
                _.get(i, 'rawat.soapDokter.obat') ? _.sum(
                  i.rawat.soapDokter.obat.map(j => j.harga)
                ) : 0,
                _.get(i, 'rawat.soapDokter.tindakan') ? _.sum(
                  i.rawat.soapDokter.tindakan.map(
                    j => +lookReferences(j.idtindakan).harga
                  )
                ) : 0
              ])),
              lookUser(i.rawat.kasir)
            ])
          ),
          'Cara Bayar: '+look('cara_bayar', +obj.selection)
        ))
      ]
    ),
    selects('cara_bayar')()
  ),

  pharmacy: () => makeReport('Pengeluaran Apotik', e => withThis(
    {start: +moment(e.target[0].value), end: +moment(e.target[1].value)},
    date => [
      e.preventDefault(),
      db.patients.toArray(array => makePdf.report(
        'Laporan Pengeluaran Obat',
        [['Tanggal', 'No. MR', 'Nama Pasien', 'Layanan', 'Dokter', 'Nama Obat', 'Jumlah']]
        .concat(array.flatMap(pasien =>
          _.compact(([]).concat(
            pasien.rawatJalan || [],
            pasien.emergency || [],
            (pasien.rawatInap || []).flatMap(i =>
              i.observasi && i.observasi
              .filter(j => j.soapDokter)
            )
          ).flatMap(rawat =>
            _.get(rawat, 'soapDokter.obat') &&
            rawat.soapDokter.obat.map(i => [
              hari(rawat.tanggal),
              pasien.identitas.no_mr,
              pasien.identitas.nama_lengkap,
              ors([
                rawat.klinik && look('klinik', rawat.klinik),
                rawat.idinap && 'Rawat Inap',
                'Gawat Darurat'
              ]),
              lookUser(rawat.soapDokter.dokter),
              lookGoods(i.idbarang).nama,
              i.jumlah
            ])
          ))
        ))
      ))
    ]
  )),
  igd: () => makeReport('Kunjungan IGD', e => withThis(
    {start: +moment(e.target[0].value), end: +moment(e.target[1].value)},
    date => [
      e.preventDefault(),
      db.patients.toArray(array => makePdf.report(
        'Kunjungan IGD',
        [['Tanggal', 'No. MR', 'Nama Pasien', 'Perawat', 'Dokter']]
        .concat(
          array.flatMap(pasien =>
            pasien.rawatJalan &&
            pasien.rawatJalan.map(rawat =>
              _.every([
                rawat.soapDokter,
                rawat.tanggal > date.start && rawat.tanggal < date.end
              ]) && [
                hari(rawat.tanggal),
                pasien.identitas.no_mr.toString(),
                pasien.identitas.nama_lengkap,
                lookUser(rawat.soapPerawat.perawat),
                lookUser(rawat.soapDokter.dokter)
              ]
            )
          )
          .sort((a, b) => a.tanggal - b.tanggal)
          .filter(i => i)
        )
      ))
    ]
  )),
  inpatient: () => makeReport('Kunjungan Rawat Inap', e => withThis(
    {start: +moment(e.target[0].value), end: +moment(e.target[1].value)},
    date => [
      e.preventDefault(),
      db.patients.toArray(array => makePdf.report(
        'Kunjungan Rawat Inap',
        [['Tanggal', 'No. MR', 'Nama Pasien', 'Perawat', 'Dokter']]
        .concat(_.compact(
          array.flatMap(pasien =>
            pasien.rawatInap &&
            pasien.rawatInap.map(rawat =>
              _.every([
                rawat.keluar,
                rawat.tanggal_masuk > date.start &&
                rawat.tanggal_masuk < date.end
              ]) && [
                hari(rawat.tanggal_masuk),
                pasien.identitas.no_mr.toString(),
                pasien.identitas.nama_lengkap,
                rawat.observasi.map(i =>
                  lookUser(i.perawat)
                ).join(', '),
                rawat.observasi.map(i =>
                  lookUser(i.dokter)
                ).join(', ')
              ]
            )
          ).sort((a, b) => a.tanggal - b.tanggal)
        ))
      ))
    ]
  )),
  outpatient: () => makeReport('Kunjungan Poliklinik', e => withThis(
    ({
      start: +moment(e.target[0].value),
      end: +moment(e.target[1].value)
    }),
    date => [
      e.preventDefault(),
      db.patients.toArray(array => makePdf.report(
        'Kunjungan Poliklinik',
        [['Tanggal', 'Poliklinik', 'No. MR', 'Nama Pasien', 'Perawat', 'Dokter']]
        .concat(_.compact(
          array.flatMap(pasien =>
            pasien.rawatJalan &&
            pasien.rawatJalan.map(rawat =>
              _.every([
                rawat.soapDokter,
                rawat.tanggal > date.start &&
                rawat.tanggal < date.end
              ]) && [
                hari(rawat.tanggal),
                look('klinik', rawat.klinik),
                pasien.identitas.no_mr.toString(),
                pasien.identitas.nama_lengkap,
                lookUser(rawat.soapPerawat.perawat),
                lookUser(rawat.soapDokter.dokter)
              ]
            )
          ).sort((a, b) => a.tanggal - b.tanggal)
        ))
      ))
    ]
  )),
}