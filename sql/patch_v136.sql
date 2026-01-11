-- v1.3.6 (선택) : answer_rank에 표시용 컬럼 추가
-- 자동 보정 코드가 포함되어 있어 꼭 실행하지 않아도 됩니다.
ALTER TABLE answer_rank ADD COLUMN display_word TEXT;
ALTER TABLE answer_rank ADD COLUMN pos TEXT;

CREATE INDEX IF NOT EXISTS idx_answer_rank_date_rank_word
ON answer_rank(date_key, rank, word_id);
