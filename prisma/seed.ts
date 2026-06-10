import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

interface IbgeEstado {
  id: number;
  sigla: string;
  nome: string;
}

interface IbgeMunicipio {
  id: number;
  nome: string;
  microrregiao: { mesorregiao: { UF: { id: number } } } | null;
}

async function main() {
  const raw = process.env.DATABASE_URL!;
  const dbUrl = new URL(raw);
  const schema = dbUrl.searchParams.get('schema') ?? 'public';
  dbUrl.searchParams.delete('schema');

  const pool = new Pool({ connectionString: dbUrl.toString() });
  const client = await pool.connect();

  try {
    await client.query(`SET search_path TO "${schema}"`);

    // ── Estados ───────────────────────────────────────────────────────────
    console.log('Buscando estados do IBGE...');
    const estadosRes = await fetch(
      'https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome',
    );
    const estados: IbgeEstado[] = await estadosRes.json() as IbgeEstado[];
    console.log(`Inserindo ${estados.length} estados...`);

    for (const e of estados) {
      await client.query(
        `INSERT INTO estado (id, codigo, nome, sigla)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO NOTHING`,
        [e.id, String(e.id), e.nome, e.sigla],
      );
    }
    await client.query(
      `SELECT setval('estado_id_seq', (SELECT MAX(id) FROM estado))`,
    );
    console.log('Estados inseridos.');

    // ── Municípios ────────────────────────────────────────────────────────
    console.log('Buscando municípios do IBGE...');
    const municipiosRes = await fetch(
      'https://servicodados.ibge.gov.br/api/v1/localidades/municipios?orderBy=nome',
    );
    const municipios: IbgeMunicipio[] = await municipiosRes.json() as IbgeMunicipio[];
    console.log(`Inserindo ${municipios.length} municípios em lotes...`);

    const BATCH = 500;
    for (let i = 0; i < municipios.length; i += BATCH) {
      const batch = municipios.slice(i, i + BATCH);
      const placeholders = batch
        .map((_, j) => `($${j * 4 + 1}, $${j * 4 + 2}, $${j * 4 + 3}, $${j * 4 + 4})`)
        .join(', ');
      const params = batch.flatMap((m) => [
        m.id,
        String(m.id),
        m.nome,
        m.microrregiao?.mesorregiao?.UF?.id ?? Math.floor(m.id / 100000),
      ]);

      await client.query(
        `INSERT INTO municipio (id, codigo, nome, estado_id)
         VALUES ${placeholders}
         ON CONFLICT (id) DO NOTHING`,
        params,
      );
      console.log(`  ${Math.min(i + BATCH, municipios.length)}/${municipios.length}`);
    }
    await client.query(
      `SELECT setval('municipio_id_seq', (SELECT MAX(id) FROM municipio))`,
    );
    console.log('Municípios inseridos.');

    // ── Usuário teste ─────────────────────────────────────────────────────
    // Senha: Teste@123  (bcrypt cost 10)
    const municipioId: number = (
      await client.query(`SELECT id FROM municipio LIMIT 1`)
    ).rows[0]?.id;

    const socioResult = await client.query(
      `INSERT INTO socio (
         nome, telefone, email, cpf_cnpj,
         tipo_pessoa, tipo_socio, concordou_estatuto,
         logradouro, numero, complemento, bairro, cep, municipio_id,
         data_criacao, data_alteracao
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW(),NOW())
       ON CONFLICT DO NOTHING
       RETURNING id`,
      ['Usuário Teste','85999990000','teste@teste.com','00000000000',
       0,1,true,'Rua Teste',1,'','Centro','60000000',municipioId],
    );

    if (socioResult.rows.length > 0) {
      const socioId: number = socioResult.rows[0].id;

      await client.query(
        `INSERT INTO usuario (nome, email, senha, usuario_ativo, roles, socio, data_criacao, data_alteracao)
         VALUES ($1,$2,$3,$4,$5,$6,NOW(),NOW())
         ON CONFLICT DO NOTHING`,
        ['Usuário Teste','teste@teste.com',
         '$2b$10$uyipDtwON2gsC52NJOOnWut0dsE4R55dWyXqOYdMfMXWbcuU7ztH6',
         true,['USER'],socioId],
      );

      await client.query(
        `INSERT INTO unidade_consumidora (
           numero_cliente, numero_uc,
           logradouro, numero, complemento, bairro, cep, municipio_id,
           socio_id, data_criacao, data_alteracao
         )
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW(),NOW())
         ON CONFLICT DO NOTHING`,
        ['000001','000001','Rua Teste',1,'','Centro','60000000',municipioId,socioId],
      );

      console.log('Usuário teste criado  →  teste@teste.com / Teste@123');
    } else {
      console.log('Usuário teste já existe, pulando.');
    }

    console.log('Seed concluído!');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
