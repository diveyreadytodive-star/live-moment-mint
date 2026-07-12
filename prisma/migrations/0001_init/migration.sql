-- CreateTable
CREATE TABLE "Fixture" (
    "id" TEXT NOT NULL,
    "p1Id" TEXT NOT NULL,
    "p2Id" TEXT NOT NULL,
    "p1Name" TEXT NOT NULL,
    "p2Name" TEXT NOT NULL,
    "p1IsHome" BOOLEAN NOT NULL,
    "p1Color" TEXT NOT NULL DEFAULT '#1a56db',
    "p2Color" TEXT NOT NULL DEFAULT '#e02424',
    "kickoffTs" INTEGER NOT NULL,

    CONSTRAINT "Fixture_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Moment" (
    "id" SERIAL NOT NULL,
    "fixtureId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "tsEvent" INTEGER NOT NULL,
    "teamScorerId" TEXT,
    "goalType" TEXT,
    "minute" INTEGER,
    "scoreP1" INTEGER NOT NULL DEFAULT 0,
    "scoreP2" INTEGER NOT NULL DEFAULT 0,
    "imageUrl" TEXT,
    "metadataUrl" TEXT,
    "momentPda" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "openTs" INTEGER NOT NULL,
    "closeTs" INTEGER NOT NULL,

    CONSTRAINT "Moment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mint" (
    "id" SERIAL NOT NULL,
    "momentId" INTEGER NOT NULL,
    "minterPubkey" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "txSig" TEXT NOT NULL,
    "createdAt" INTEGER NOT NULL,

    CONSTRAINT "Mint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Moment_fixtureId_seq_kind_key" ON "Moment"("fixtureId", "seq", "kind");

-- AddForeignKey
ALTER TABLE "Moment" ADD CONSTRAINT "Moment_fixtureId_fkey" FOREIGN KEY ("fixtureId") REFERENCES "Fixture"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mint" ADD CONSTRAINT "Mint_momentId_fkey" FOREIGN KEY ("momentId") REFERENCES "Moment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
